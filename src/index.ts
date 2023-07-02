import { fromPairs, sortBy, toPairs } from 'lodash';
import { brill } from 'brill';
import isoStopWordSet from 'stopwords-iso/stopwords-iso.json';

const CHAR_CODE_ZERO = "0".charCodeAt(0);
const CHAR_CODE_NINE = "9".charCodeAt(0);

/**
 * A function that takes a keyword and returns true if it is acceptable, false otherwise.
 */
type AcceptabilityFilter = (keyword: string) => boolean;

/**
 * Tests whether a string character is a digit.
 * @param char
 */
function isNumber(char: string) {
    // In case the "char" is not actually a single character; we only care about the first character.
    const charCode = char.charCodeAt(0);
    return( charCode >= CHAR_CODE_ZERO && charCode <= CHAR_CODE_NINE );
}

/**
 * Create an AcceptabilityFilter that filters out words in a given Set<string>.
 */
function createStopWordFilter(stopWordSet: Set<string>): AcceptabilityFilter {
    return (keyword: string) => !stopWordSet.has(keyword);
}

/**
 * Create an AcceptabilityFilter that filters for:
 * - A phrase must have at least one alpha character
 * - A phrase must have more alpha than digits characters
 */
function createAlphaDigitsAcceptabilityFilter(): AcceptabilityFilter {
    return (phrase: string) => {
        let digits = 0;
        let alpha = 0;
        for (let i = 0; i < phrase.length; i++) {
            if (/\d/.test(phrase[i])) {
                digits += 1;
                continue
            }
            if (/[a-zA-Z]/.test(phrase[i])) {
                alpha += 1;
            }
        }
        return (alpha > 0 && digits <= alpha);
    };
}

/**
 * Create an AcceptabilityFilter that filters for minCharLength.
 */
function createMinCharLengthFilter(minCharLength: number): AcceptabilityFilter {
    return (phrase: string) => phrase.length >= minCharLength;
}

/**
 * Create an AcceptabilityFilter that filters for maxWordsLength, using the word boundary regex.
 */
function createMaxWordsLengthFilter(maxWordsLength: number): AcceptabilityFilter {
    return (phrase: string) => phrase.split(/\b/).length <= maxWordsLength;
}

function countOccurrences(haystack: string[], needle: string): number {
    return haystack.reduce((n: number, value: string) => {
        return n + (value === needle ? 1 : 0);
    }, 0);
}

function generateCandidateKeywordScores(
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

function separateWords(text: string, minWordReturnSize: number): string[] {
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

function calculateWordScores(phraseList: string[]): Record<string, number> {
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
        wordScore[item] = wordDegree[item] / (wordFrequency[item]);
    });

    return wordScore;
}

/**
 * Extract raw keywords from a text using regex word boundary matching.
 */
function extractRawKeywords(text: string): string[] {
    return text.match(/\b\w+\b/g);
}

/**
 * Normalizes raw keywords by converting to lowercase and removing leading and trailing whitespace.
 */
function normalizeKeyword(rawKeyword: string): string {
    return rawKeyword.toLowerCase().trim();
}

/**
 * Filters normalized keywords using a set of stop words and zero or many manual acceptability filters.
 * Finally, deduplicates the keywords.
 */
function filterKeywords(
    normalizedKeywords: string[],
    acceptabilityFilters: AcceptabilityFilter[]
): string[] {
    return acceptabilityFilters.reduce(
        (keywords, filter) => keywords.filter(filter),
        normalizedKeywords
    );
}

/**
 * Extracts keywords from text using RAKE and POS tag filtering
 * @param {string} text - The text from which keywords are to be extracted.
 * @param {string} [language='en'] - The language of the text.
 * @param {Set<string>} [additionalStopWordSet=new Set<string>([''])] - Additional set of stop words to be excluded.
 * @param {Set<string>} [posAllowedSet=new Set<string>(['NN', 'NNS'])] - Set of allowed parts of speech (POS) tags.
 * @param {number} [minCharLength=1] - Minimum character length for a keyword.
 * @param {number} [maxWordsLength=5] - Maximum number of words in a keyword.
 * @param {number} [minKeywordFrequency=1] - Minimum frequency of a keyword to be considered.
 * @returns {string[]} - An array of extracted keywords.
 */
export default function extractWithRakePos({
    text,
    language = 'en',
    additionalStopWordSet,
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
    const combinedStopWordSet = additionalStopWordSet ? new Set([...isoStopWordSet[language], ...additionalStopWordSet]) : isoStopWordSet[language];
    const rawPhraseList = extractRawKeywords(text).map(normalizeKeyword);
    const phraseList = filterKeywords(
        rawPhraseList,
        [
            createStopWordFilter(combinedStopWordSet),
            createMinCharLengthFilter(minCharLength),
            // NOTE(2 July 2023): This filter is disabled because the original implementation in this package made it irrelevant.
            //   To make this relevant, we need to create "keywords" in a way that allows whitespace to be included.
            // createMaxWordsLengthFilter(maxWordsLength),
            createAlphaDigitsAcceptabilityFilter()
        ])
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
