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
            text: 'this cat is an ad',
            minCharLength: 3,
            posAllowedSet: new Set(['NN'])
        });
        expect(keywords).toEqual(['cat']);
    });

    test('should filter out phrases with more digits than alpha characters', () => {
        const keywords = extractWithRakePos({
            text: 'this CFM56 does not go on a B70',
            posAllowedSet: new Set(['NN'])
        });
        expect(keywords).toEqual(['cfm56']);
    });

    test('should only return keywords with allowed POS tags', () => {
        brill['abs'] = ['NN'];
        const keywords = extractWithRakePos({
            text: 'jeremy has no abs',
            posAllowedSet: new Set(['NN'])
        });
        expect(keywords).toEqual(['abs']);
    });

    test('should only return keywords with minimum frequency', () => {
        brill['cat'] = ['NN'];
        const keywords = extractWithRakePos({
            text: 'cat in the hat is cat in the bag',
            minKeywordFrequency: 2,
            posAllowedSet: new Set(['NN'])
        });
        expect(keywords).toEqual(['cat']);
    });

    test('should work with different languages', () => {
        brill['hola'] = ['NN'];
        brill['mundo'] = ['NN'];
        const keywords = extractWithRakePos({
            text: '¡hola, mundo!',
            language: 'es',
            posAllowedSet: new Set(['NN'])
        });
        expect(keywords).toEqual(['hola', 'mundo']);
    });

    test('should work with phrases', () => {
        const keywords = extractWithRakePos({
            text: 'Natural language processing (NLP) is a subfield of artificial intelligence. It focuses on the interaction between computers and humans. Natural language processing techniques are used in various applications.',
        });
        expect(keywords).toEqual([
            'natural language processing techniques',
            'natural language processing',
            'artificial intelligence',
            'nlp',
            'subfield',
            'focuses',
            'interaction',
            'computers',
            'humans',
            'applications'
        ]);
    });

    test('should be able to filter out long phrases', () => {
      const keywords = extractWithRakePos({
          text: 'Natural language processing (NLP) is a subfield of artificial intelligence. It focuses on the interaction between computers and humans. Natural language processing techniques are used in various applications.',
          maxWordsLength: 3,
      });
      expect(keywords).toEqual([
          'natural language processing',
          'artificial intelligence',
          'nlp',
          'subfield',
          'focuses',
          'interaction',
          'computers',
          'humans',
          'applications'
      ]);
  });
});
