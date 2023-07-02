import {brill} from 'brill';
import extractWithRakePos from '../src/index';

// NOTE(2 July 2023): This test suite is highly coupled to the contents of `brill` for each term.
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
            text: 'a ab cat',
            minCharLength: 2,
            posAllowedSet: new Set(['NN'])
        });
        expect(keywords).toEqual(['ab', 'cat']);
    });

    test('should filter out phrases with more digits than alpha characters', () => {
        const keywords = extractWithRakePos({
            text: 'b2 CFM56',
            posAllowedSet: new Set(['NN'])
        });
        expect(keywords).toEqual(['cfm56']);
    });

    test('should only return keywords with minimum frequency', () => {
        const keywords = extractWithRakePos({
            text: 'ab ab cat',
            minKeywordFrequency: 2,
            posAllowedSet: new Set(['NN'])
        });
        expect(keywords).toEqual(['ab']);
    });

    test('should only return keywords with allowed POS tags', () => {
        brill['ab'] = ['NN'];
        brill['cd'] = ['JJ'];
        const keywords = extractWithRakePos({
            text: 'ab jeremy',
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
