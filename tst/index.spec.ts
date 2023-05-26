import extractWithRakePos from '../src/index';

describe('extractWithRakePos', () => {
  it('should extract keywords based on input', () => {
    const text = 'I have some apples and bananas here for the table';
    const stopWordSet = new Set(['the', 'and', 'of', 'some', 'apples', 'have']); // Example stop words
    const posAllowedSet = new Set(['NN', 'NNS']); // Example POS allowed set

    const keywords = extractWithRakePos({ text, stopWordSet, posAllowedSet });

    expect(keywords.sort()).toEqual(['bananas', 'table'].sort());
  });
});