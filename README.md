# rake-pos: Rapid automatic keyword extraction with Part-of-Speech post-processing

The goal of this library was to create a Typescript translation of the
[javacsript implementation](https://github.com/sleepycat/rapid-automated-keyword-extraction),
which in itself was a translation of the [python implementation](https://github.com/zelandiya/RAKE-tutorial).

In addition, Part-of-Speech post-processing is used to further filter keywords. This is done by
using [an implementation of brill tagging](https://github.com/words/brill). For usage details,
see the [list of brill tag descriptions](https://github.com/words/brill/blob/main/lib/descriptions.js)

# Usage

```typescript
let keywords: string[] = [];
console.log(keywords);
> []
const text = 'I have some apples and bananas here for the table';
const stopWordSet = new Set(['the', 'and', 'of', 'some', 'apples', 'have']); // Example stop words
const posAllowedSet = new Set(['NN', 'NNS']); // Example POS allowed set
keywords = extractWithRakePos({ text, stopWordSet, posAllowedSet });
console.log(keywords);
> ['table', 'bananas']
```

# Original README from javacsript implementation below:

Differences in regular expressions and stopword lists have big impacts on this algorithm and
sticking close to the python means that the code was easy to compare to ensure
that it was in the ballpark.

This algorithm is described in [Text Mining: Applications and
Theory](https://www.amazon.ca/Text-Mining-Applications-Michael-Berry/dp/0470749822)
and also in this [excellent blog
post](https://www.airpair.com/nlp/keyword-extraction-tutorial) by Alyona
Medelyan.

It operates using only the text you give it and produces surprisingly good
results. There are likely [better results
possible](http://bdewilde.github.io/blog/2014/09/23/intro-to-automatic-keyphrase-extraction/)
but these mostly seem to involve a combination of Python, Machine Learning and
a corpus of data.

The appeal of RAKE is of the "bang for the buck" variety.

Currently this library produces subtly different results than either the paper
or the original Python implementation. While the results (especially the top
scoring ones) line up nicely, these little deviations represent something to
understand and resolve.

## What's next

After hammering out differences in the results, plans are to focus on

* Fully embracing JS idioms (Promises/ES201X)
* Explore ways to improve the results as described
  [here](https://www.ijarcsse.com/docs/papers/Volume_6/5_May2016/V6I5-0392.pdf)
* Options to control result format (number, result|result+rank, etc)
* Include default stopword list.
* Improve handling of special characters and italics
* Deal with sentences that have been split over multiple lines (sentence now ends with -)

## Stopword lists

The stopword list used by the python version is [here](https://github.com/zelandiya/RAKE-tutorial/blob/master/SmartStoplist.txt).
It has a comment as the first line which might break the world...

Links to other stopword lists can be found [here](http://trialstravails.blogspot.ca/2014/04/fox-stop-words-list.html)

Any file with one word per line should be fine.
