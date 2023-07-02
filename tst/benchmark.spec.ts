import extractWithRakePos from '../src/index';
import * as https from "https";

const LONGEST_TEXT_EVER = 'https://whiletrue.neocities.org/lte';

function timer(fn, ...args: any[]) {
    const start = new Date().getTime();

    fn(...args);

    const end = new Date().getTime();
    return end - start;
}

async function fetch(urlString: string): Promise<string> {

    return new Promise((resolve, reject) => {
        https.get(urlString, res => {
            let data = [];
            res.on('data', chunk => {
                data.push(chunk);
            });

            res.on('end', () => {
                resolve(Buffer.concat(data).toString())
            });
        }).on('error', reject)
    })
}

// Fetch a long text from the internet, run through `extractWithRakePos` and time it.
describe('extractWithRakePos benchmark', () => {
    test('should run in less than 1 second', async () => {
        const text = await fetch(LONGEST_TEXT_EVER);
        const time = timer(extractWithRakePos, {text, additionalStopWordSet: new Set(["apples"]), minKeywordFrequency: 3});
        expect(time).toBeLessThan(1000);
    })
})
