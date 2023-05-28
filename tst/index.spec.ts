import extractWithRakePos from '../src/index';

describe('extractWithRakePos', () => {
  it('should extract keywords based on input', () => {
    const input: string = 'I have some apples and bananas here for the table';
    const stop: Set<string> = new Set(['apples']);
    const keywords = extractWithRakePos({ text: input, additionalStopWordSet: stop });

    expect(keywords.sort()).toEqual(['bananas', 'table'].sort());
  });
});