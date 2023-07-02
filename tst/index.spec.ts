import {brill} from 'brill';
import extractWithRakePos from '../src/index';

describe('extractWithRakePos function', () => {

    test('should extract keywords based on input', () => {
        const input: string = 'I have some apples and bananas here for the table';
        const stop: Set<string> = new Set(['apples']);
        const keywords = extractWithRakePos({text: input, additionalStopWordSet: stop});

        expect(keywords.sort()).toEqual(['bananas', 'table'].sort());
    });

    test('should return an empty array when the input text is empty', () => {
        const keywords = extractWithRakePos({text: ''});
        expect(keywords).toEqual([]);
    });

    test('should filter out stop words', () => {
        const keywords = extractWithRakePos({
            text: 'the and is',
            additionalStopWordSet: new Set(['and']),
            posAllowedSet: new Set(['NN'])
        });
        expect(keywords).toEqual([]);
    });

    test('should return keywords with minimum character length', () => {
        const keywords = extractWithRakePos({
            text: 'a ab abc',
            minCharLength: 2,
            posAllowedSet: new Set(['NN'])
        });
        expect(keywords).toEqual(['ab', 'abc']);
    });

    test('should filter out phrases with more digits than alpha characters', () => {
        const keywords = extractWithRakePos({
            text: 'ab1 123 ab1c',
            posAllowedSet: new Set(['NN'])
        });
        expect(keywords).toEqual(['ab1c']);
    });

    test('should only return keywords with minimum frequency', () => {
        const keywords = extractWithRakePos({
            text: 'ab ab cd',
            minKeywordFrequency: 2,
            posAllowedSet: new Set(['NN'])
        });
        expect(keywords).toEqual(['ab']);
    });

    test('should only return keywords with allowed POS tags', () => {
        brill['ab'] = ['NN'];
        brill['cd'] = ['JJ'];
        const keywords = extractWithRakePos({
            text: 'ab cd',
            posAllowedSet: new Set(['NN'])
        });
        expect(keywords).toEqual(['ab']);
    });

    test('should work with different languages', () => {
        brill['hola'] = ['NN'];
        const keywords = extractWithRakePos({
            text: 'hola mundo',
            language: 'es',
            posAllowedSet: new Set(['NN'])
        });
        expect(keywords).toEqual(['hola']);
    });
});
