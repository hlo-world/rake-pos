import { fromPairs, sortBy, toPairs } from 'lodash';
import { brill } from 'brill';
import isoStopWordSet from 'stopwords-iso/stopwords-iso.json';

function isNumber(str: string): boolean {
    return /\d/.test(str);
}

// TODO: smaller functions should be extracted from this
export function isAcceptable(phrase: string, minCharLength: number, maxWordsLength: number): boolean {
    // A phrase must have a min length in characters
    if (phrase.length < minCharLength) {
        return false;
    }
    // A phrase must have a max number of words
    const words = phrase.split(' ');
    if (words.length > maxWordsLength) {
        return false;
    }

    let digits = 0;
    let alpha = 0;
    // Is there a better way to do this?
    for (let i = 0; i < phrase.length; i++) {
        if (/\d/.test(phrase[i])) {
            digits += 1;
        }
        if (/[a-zA-Z]/.test(phrase[i])) {
            alpha += 1;
        }
    }

    // A phrase must have at least one alpha character
    if (alpha === 0) {
        return false;
    }

    // A phrase must have more alpha than digits characters
    if (digits > alpha) {
        return false;
    }

    return true;
}

export function countOccurrences(haystack: string[], needle: string): number {
    return haystack.reduce((n: number, value: string) => {
        return n + (value === needle ? 1 : 0);
    }, 0);
}

export function generateCandidateKeywordScores(
    phraseList: string[],
    wordScore: Record<string, number>,
    minKeywordFrequency = 1
): Record<string, number> {
    const keywordCandidates: Record<string, number> = {};

    phraseList.forEach((phrase) => {
        if (minKeywordFrequency > 1) {
            if (countOccurrences(phraseList, phrase) < minKeywordFrequency) {
                return;
            }
        }
        if (!(phrase in keywordCandidates)) {
            keywordCandidates[phrase] = 0;
        }
        const wordList = separateWords(phrase, 0);
        let candidateScore = 0;
        wordList.forEach((word) => {
            candidateScore += wordScore[word];
            keywordCandidates[phrase] = candidateScore;
        });
    });
    return keywordCandidates;
}

export function separateWords(text: string, minWordReturnSize: number): string[] {
    const wordDelimiters = /[^a-zA-Z0-9_+\-/]/;
    const words: string[] = [];
    text.split(wordDelimiters).forEach((singleWord) => {
        const currentWord = singleWord.trim().toLowerCase();
        // Leave numbers in phrase, but don't count as words, since they tend to invalidate scores of their phrases
        if (currentWord.length > minWordReturnSize && currentWord !== '' && !isNumber(currentWord)) {
            words.push(currentWord);
        }
    });
    return words;
}

export function calculateWordScores(phraseList: string[]): Record<string, number> {
    const wordFrequency: Record<string, number> = {};
    const wordDegree: Record<string, number> = {};
    phraseList.forEach((phrase) => {
        const wordList = separateWords(phrase, 0);
        const wordListLength = wordList.length;
        const wordListDegree = wordListLength - 1;
        wordList.forEach((word) => {
            if (!(word in wordFrequency)) {
                wordFrequency[word] = 0;
            }
            wordFrequency[word] += 1;
            if (!(word in wordDegree)) {
                wordDegree[word] = 0;
            }
            wordDegree[word] += wordListDegree;
        });
    });

    Object.keys(wordFrequency).forEach((item) => {
        wordDegree[item] = wordDegree[item] + wordFrequency[item];
    });

    // Calculate Word scores = deg(w)/frew(w)
    const wordScore: Record<string, number> = {};
    Object.keys(wordFrequency).forEach((item) => {
        if (!(item in wordScore)) {
            wordScore[item] = 0;
        }
        wordScore[item] = wordDegree[item] / (wordFrequency[item] * 1.0);
    });

    return wordScore;
}

export function generateCandidateKeywords(
    sentenceList: string[],
    stopWordSet: Set<string>,
    minCharLength = 1,
    maxWordsLength = 5
): string[] {
    const phraseList: string[] = [];
    sentenceList.forEach((sentence) => {
        const tmp = sentence.replace(/[^\w\s]|_/g, '').replace(/\s+/g, ' ');
        const phrases = tmp.split(' ');
        phrases.forEach((ph) => {
            const phrase = ph.trim().toLowerCase();
            if (phrase !== '' && isAcceptable(phrase, minCharLength, maxWordsLength) && !stopWordSet.has(phrase)) {
                phraseList.push(phrase);
            }
        });
    });
    return phraseList;
}

export function splitSentences(text: string): string[] {
    const sentenceDelimiters = /[[\]!.?,;:\t\\\-"'()'\u2019\u2013\n]/;
    return text.split(sentenceDelimiters);
}

/**
 * Extracts keywords from text using RAKE and POS tag filtering
 * 
 * @param {string} text - The text from which keywords are to be extracted.
 * @param {string} [language='en'] - The language of the text.
 * @param {Set<string>} [additionalStopWordSet=new Set<string>([''])] - Additional set of stop words to be excluded.
 * @param {Set<string>} [posAllowedSet=new Set<string>(['NN', 'NNS'])] - Set of allowed parts of speech (POS) tags.
 * @param {number} [minCharLength=1] - Minimum character length for a keyword.
 * @param {number} [maxWordsLength=5] - Maximum number of words in a keyword.
 * @param {number} [minKeywordFrequency=1] - Minimum frequency of a keyword to be considered.
 * 
 * @returns {string[]} - An array of extracted keywords.
 */
export default function extractWithRakePos({
    text,
    language = 'en',
    additionalStopWordSet = new Set<string>(['']),
    posAllowedSet = new Set<string>(['NN', 'NNS']),
    minCharLength = 1,
    maxWordsLength = 5,
    minKeywordFrequency = 1,
}: {
    text: string;
    language?: string;
    additionalStopWordSet?: Set<string>;
    posAllowedSet?: Set<string>;
    minCharLength?: number;
    maxWordsLength?: number;
    minKeywordFrequency?: number;
}): string[] {
    const combinedStopWordSet = new Set([...isoStopWordSet[language], ...additionalStopWordSet]);
    const sentenceList = splitSentences(text);
    const phraseList = generateCandidateKeywords(sentenceList, combinedStopWordSet, minCharLength, maxWordsLength);
    const wordScores = calculateWordScores(phraseList);
    const keywordCandidates = generateCandidateKeywordScores(phraseList, wordScores, minKeywordFrequency);
    const sortedKeywords = fromPairs(sortBy(toPairs(keywordCandidates), (pair: any) => pair[1]).reverse());
    const keywordsList: string[] = Object.keys(sortedKeywords);
    const posAllowedList = Array.from(posAllowedSet);
    // filter by POS input set
    const posFilteredKeywordsList = keywordsList.filter((keyword) => {
        const keywordPOS = brill[keyword];
        return keywordPOS && posAllowedList.some((allowedPOS) => keywordPOS.includes(allowedPOS));
    });
    return posFilteredKeywordsList;
}
