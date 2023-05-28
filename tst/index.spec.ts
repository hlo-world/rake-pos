import extractWithRakePos from '../src/index';

describe('extractWithRakePos', () => {
  it('should extract keywords based on input', () => {
    const text: string = 'I have some apples and bananas here for the table';
    const additionalStopWordSet: Set<string> = new Set(['apples']);
    const keywords = extractWithRakePos({ text, additionalStopWordSet });

    expect(keywords.sort()).toEqual(['bananas', 'table'].sort());
  });
});