import { brill } from 'brill';
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
        return (alpha > 0 && digits < alpha);
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
    return (phrase: string) => phrase.split(/\s/).length <= maxWordsLength;
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

    phraseList.forEach((phrase) => {
        if (!(phrase in phraseScores)) {
            phraseScores[phrase] = { frequency: 0, score: 0 };
            phraseToWordScores[phrase] = new Set();
        }
        // Filter on this value after we tally scores for all our subphrases (words).
        phraseScores[phrase].frequency += 1;

        const wordList = separateWords(phrase, 0);
        const wordListDegree = wordList.length - 1;
        wordList.forEach((word) => {
            if (!(word in keywordScores)) {
                keywordScores[word] = { frequency: 0, degree: 0, score: 0 };
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
            delete phraseScores[phrase];
            continue;
        }
        for (const wordScore of wordScores) {
            phraseScores[phrase].score += wordScore.score;
        }
    }

    return { phrases: phraseScores, keywords: keywordScores };
}

/**
 * Extract raw keyphrases from a text using regex word boundary matching.
 */
function extractKeyphrases(text: string, stopwords: Set<string>): string[] {
    // Convert the input text to lowercase for case-insensitive comparison
    const lowercaseText = text.toLowerCase();

    // Define common punctuations to split the text
    const punctuations = /[!¡"#$%&'()*+,-./:;<=>¿?@[\]^_`{|}~]/g;

    // Split the text into individual words
    const words = lowercaseText.split(/\s+/);

    // Initialize an array to store the keyphrases
    const keyPhrases: string[] = [];

    let currentPhrase = '';

    // Iterate through each word in the text
    for (let i = 0; i < words.length; i++) {
        const word = words[i];

        // Skip stopwords and empty words and punctuations
        if (stopwords.has(word) || word.length === 0 || word.replace(punctuations, '').length === 0) {
            // Add the previous phrase (if any) to the keyPhrases array
            if (currentPhrase.length > 0) {
                keyPhrases.push(currentPhrase);
            }

            // Start a new phrase
            currentPhrase = '';
            continue;
        }

        // If word starts with any punctuation, cut off previous phrase and strip all leading punctuations on current word
        if (word.charAt(0).match(punctuations)) {
            if (currentPhrase.length > 0) {
                keyPhrases.push(currentPhrase);
            }
            // Remove leading punctuations
            const leadingPunctuations = /^[\p{P}]+/u;
            words[i] = word.replace(leadingPunctuations, '');

            // Start a new phrase
            currentPhrase = '';
        }

        // Add the current word to the last phrase if it's a continuation
        currentPhrase += ' ' + word;

        // Cut it off if the word ends in any punctuation
        if (word.charAt(word.length - 1).match(punctuations)) {
            keyPhrases.push(currentPhrase.replace(punctuations, ''));
            currentPhrase = '';
        }
    }

    // Add the last phrase to the keyPhrases array
    if (currentPhrase.length > 0) {
        keyPhrases.push(currentPhrase);
    }

    return keyPhrases;
}

/**
 * Normalizes raw keywords by converting to lowercase and removing leading and trailing whitespace.
 */
function normalizeKeyword(rawKeyword: string): string {
    return rawKeyword.toLowerCase().trim();
}

/**
 * Chains multiple AcceptabilityFilters together to create a single AcceptabilityFilter.
 */
function chainAcceptabilityFilters(...filters: AcceptabilityFilter[]): AcceptabilityFilter {
    // We could use `every`, but this will short circuit on the first false.
    return (keyword: string) => {
        for (const filter of filters) {
            if (!filter(keyword)) {
                return false;
            }
        }
        return true;
    }
}


/**
 * Filters normalized keywords using a set of stop words and zero or many manual acceptability filters.
 */
function filterKeywords(
    normalizedKeywords: string[],
    acceptabilityFilters: AcceptabilityFilter[]
): string[] {
    const chain = chainAcceptabilityFilters(...acceptabilityFilters);
    return normalizedKeywords.filter(chain);
}

/**
 * Given a keyword, query the `brill` implementation using lowercase, UPPERCASE, Titlecase, SPLIT-123 variants.
 */
function queryBrill(keyword: string): string[] {
    const basic = brill[keyword] || [];
    const upper = brill[keyword.toUpperCase()] || [];
    const title = brill[keyword[0].toUpperCase() + keyword.slice(1)] || [];
    const splitNums = brill[keyword.replace(/[^a-zA-Z0-9]/g, ' ')] || [];
    return [...new Set([...basic, ...upper, ...title, ...splitNums])];
}

/**
 * Extracts keywords from text using RAKE and POS tag filtering
 * @param {string} text - The text from which keywords are to be extracted.
 * @param {string} [language='en'] - The language of the text.
 * @param {Set<string>} [additionalStopWordSet=new Set<string>([''])] - Additional set of stop words to be excluded.
 * @param {Set<string>} - Set of allowed parts of speech (POS) tags. If set, only return words that intersect words in the POS tags' list
 * @param {number} [minCharLength=1] - Minimum character length for a keyword.
 * @param {number} [maxWordsLength=5] - Maximum number of words in a keyword.
 * @param {number} [minKeywordFrequency=1] - Minimum frequency of a keyword to be considered.
 * @returns {string[]} - An array of extracted keywords.
 */
export default function extractWithRakePos({
    text,
    language = 'en',
    additionalStopWordSet,
    posAllowedSet,
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
    const combinedStopWordSet = additionalStopWordSet ?
        new Set([...isoStopWordSet[language], ...additionalStopWordSet]) :
        new Set(isoStopWordSet[language] || []);
    const rawPhraseList = extractKeyphrases(text, new Set(isoStopWordSet[language])).map(normalizeKeyword);
    const phraseList = filterKeywords(
        rawPhraseList,
        [
            createMinCharLengthFilter(minCharLength),
            createStopWordFilter(combinedStopWordSet),
            createMaxWordsLengthFilter(maxWordsLength),
            createAlphaDigitsAcceptabilityFilter()
        ])
    // Score the phrases and keywords all at once, to avoid performing repeat computations many times. We could also
    // use memoization, but this is simpler.
    const { phrases } = generateScoredPhrases(phraseList, minKeywordFrequency);
    
    // Get a list of <phrase, score> pairs for sorting.
    const keywordCandidatesPairs: [string, number][] = Object.entries(phrases).map(
        ([phrase, score]) => [phrase, score.score]
    );

    // Sort descending by score, in place.
    keywordCandidatesPairs.sort((p1, p2) => p2[1] - p1[1])

    // Get only the keys of the sorted pairs
    let result = keywordCandidatesPairs.map((pair) => pair[0]);
    if (posAllowedSet) {
        // Filter by existence of intersection between brill content and our
        //   allowed parts of speech `posAllowedSet`.
        result = result
                    .filter((keyword) => {
                        const keywordPOS = queryBrill(keyword);
                        const intersect = new Set([...keywordPOS].filter(x => posAllowedSet.has(x)));
                        return intersect.size > 0;
                    });
    }
    return result;
}
