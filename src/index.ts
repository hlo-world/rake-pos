import {brill} from 'brill';
import isoStopWordSet from 'stopwords-iso/stopwords-iso.json';

const CHAR_CODE_ZERO = "0".charCodeAt(0);
const CHAR_CODE_NINE = "9".charCodeAt(0);
const DEFAULT_WORD_DELIMITERS = /[^a-zA-Z0-9_+\-/]/

/* --- TYPES --- */

/**
 * A function that takes a keyword and returns true if it is acceptable, false otherwise.
 */
type AcceptabilityFilter = (keyword: string) => boolean;

/**
 * A record of a keyword's frequency, degree, and score.
 */
type KeywordScores = { frequency: number, degree: number, score: number }

/**
 * A record of each phrase to its frequency and score.
 */
type PhraseScores = Record<string, { frequency: number, score: number }>;

/**
 * A record of each phrase to its score, and each keyword to its frequency, degree, and score.
 */
type MultiScores = { phrases: PhraseScores, keywords: Record<string, KeywordScores> }

/* --- IMPLEMENTATION --- */

/**
 * Tests whether a string character is a digit.
 * @param char
 */
function isNumber(char: string) {
    // In case the "char" is not actually a single character; we only care about the first character.
    const charCode = char.charCodeAt(0);
    return (charCode >= CHAR_CODE_ZERO && charCode <= CHAR_CODE_NINE);
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

/**
 * Split words in a phrase with a custom regex word boundary.
 * @param text
 * @param minWordReturnSize
 * @param wordBoundary
 */
function separateWords(text: string, minWordReturnSize: number, wordBoundary: RegExp = DEFAULT_WORD_DELIMITERS): string[] {
    const words: string[] = [];
    text.split(wordBoundary).forEach((singleWord) => {
        const currentWord = singleWord.trim().toLowerCase();
        // Leave numbers in phrase, but don't count as words, since they tend to invalidate scores of their phrases
        if (currentWord.length > minWordReturnSize && currentWord !== '' && !isNumber(currentWord)) {
            words.push(currentWord);
        }
    });
    return words;
}

/**
 * Return a record of each phrase to its score.
 * Also return the interstitial record of keyword to each keyword's frequency, degree, and score.
 */
function generateScoredPhrases(phraseList: string[], minKeywordFrequency = 1): MultiScores {
    // We need to score each word across all phrases.
    const keywordScores: Record<string, KeywordScores> = {}
    // Use this  to track references to each word in phrase, then tally the
    //  phrase score from references.
    const phraseScores: PhraseScores = {}
    const phraseToWordScores: Record<string, Set<KeywordScores>> = {};

    // NOTE(2 July 2023): This implementation retains a phrase-splitting step that is not
    //  relevant to this implementation. It is retained for compatibility with the target
    //  RAKE implementation. To make this step relevant, we would need to implement a phrase
    //  extraction algorithm that allows whitespace-separated keywords in a phrase.
    phraseList.forEach((phrase) => {
        if (!(phrase in phraseScores)) {
            phraseScores[phrase] = {frequency: 0, score: 0};
            phraseToWordScores[phrase] = new Set();
        }
        // Filter on this value after we tally scores for all our subphrases (words).
        phraseScores[phrase].frequency += 1;

        const wordList = separateWords(phrase, 0);
        const wordListDegree = wordList.length - 1;
        wordList.forEach((word) => {
            if (!(word in keywordScores)) {
                keywordScores[word] = {frequency: 0, degree: 0, score: 0};
            }
            phraseToWordScores[phrase].add(keywordScores[word]);
            keywordScores[word].frequency += 1;
            keywordScores[word].degree += wordListDegree;
        });
    });

    // Tally the score for each keyword across all phrases.
    for (const [_, score] of Object.entries(keywordScores)) {
        score.score = score.degree / score.frequency;
    }

    // Tally the score for each phrase that meets the minimum keyword frequency.
    for (const [phrase, wordScores] of Object.entries(phraseToWordScores)) {
        // We don't check for `undefined` because we initialize phraseScores with phraseToWordScores.
        if (phraseScores[phrase].frequency < minKeywordFrequency) {
            continue
        }
        for (const wordScore of wordScores) {
            phraseScores[phrase].score += wordScore.score;
        }
    }

    return {phrases: phraseScores, keywords: keywordScores};
}

/**
 * Extract raw keywords from a text using regex word boundary matching.
 */
function extractRawKeywords(text: string): string[] {
    return text.match(/\b\w+\b/g) || [];
}

/**
 * Normalizes raw keywords by converting to lowercase and removing leading and trailing whitespace.
 */
function normalizeKeyword(rawKeyword: string): string {
    return rawKeyword.toLowerCase().trim();
}

/**
 * Filters normalized keywords using a set of stop words and zero or many manual acceptability filters.
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

    // Score the phrases and keywords all at once, to avoid performing repeat computations many times. We could also
    // use memoization, but this is simpler.
    const {phrases} = generateScoredPhrases(phraseList, minKeywordFrequency);

    // Get a list of <phrase, score> pairs for sorting.
    const keywordCandidatesPairs: [string, number][] = Object.entries(phrases).map(
        ([phrase, score]) => [phrase, score.score]
    );

    // Sort descending by score, in place.
    keywordCandidatesPairs.sort((p1, p2) => p2[1] - p1[1])

    // Get only the keys of the sorted pairs, then filter by existence of intersection between brill content and our
    //   allowed parts of speech `posAllowedSet`.
    return keywordCandidatesPairs.map((pair) => pair[0])
        .filter((keyword) => {
            const keywordPOS = brill[keyword] || []; // Protect against undefined.
            const intersect = new Set([...keywordPOS].filter(x => posAllowedSet.has(x)));
            return intersect.size > 0;
        });
}
