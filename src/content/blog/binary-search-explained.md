---
title: "Binary Search, Explained"
slug: binary-search-explained
publishDate: '2026-09-29'
description: "A complete tour of binary search: the guessing-game intuition, pseudocode you can port to any language, the logarithmic payoff, when to reach for it and when not to, and the famous overflow bug hiding in the obvious line."
image: '/assets/blog/binary-search-explained.webp'
categories: ['Tutorials']
tags: ['algorithms', 'searching', 'pseudocode', 'complexity']
author: Andrew
comments_enabled: true
featured: true
---

Here is a game you have probably played. Someone picks a number between 1
and 100, and you have to find it. After every guess, they tell you whether
you went too high or too low. Most people arrive at the winning strategy
within a few rounds: guess the middle. Start at 50. Too high? The answer
lives somewhere in 1 to 49, so guess 25. Every guess cuts the remaining
possibilities in half, which means seven guesses are always enough to nail
any number in the range, because $2^7 = 128$ exceeds 100.

That strategy has a name, and you have almost certainly used it without
thinking about it: **binary search**. It is how you look up a word in a
dictionary, how your hand moves through a phone book (ask your parents),
and how `git bisect` hunts down the commit that broke your build. In this
post we walk through the algorithm in pseudocode, trace it by hand, look
at why it is so fast, talk about when to reach for it, and meet the famous
bug that lived in Java's standard library for nine years.

## What Binary Search Actually Is

Binary search finds a target value in a **sorted** list. The sorted part
is not a footnote, it is the engine of the whole thing: only sorted data
lets you conclude that an entire half of the list is irrelevant after a
single comparison.

The algorithm keeps two markers around the region where the target could
still live. Call them `low` and `high`. Look at the middle element of that
region, and one comparison tells you one of three things:

- If the middle element **equals** the target, you are done.
- If the middle element is **smaller** than the target, everything at or
  before the middle is also too small, and the whole left half can be
  discarded.
- If the middle element is **larger** than the target, the right half is
  now irrelevant. Discard it.

Either way, you have thrown away half of the remaining candidates with one
comparison, and you repeat until you find the target or the region between
`low` and `high` becomes empty. The region never grows, so the loop always
terminates.

The entire correctness of the algorithm rests on one sentence: at every
moment, the target, if it exists at all, lies somewhere between `low` and
`high`. Everything outside that window has already been ruled out. Hold
onto that invariant and the pseudocode almost writes itself.

## In Pseudocode

Here is the algorithm in language-neutral pseudocode. I am using `<-` for
assignment, `DIV` for integer division that truncates, and 0-based indexing
like Python, C, and Rust:

```text
FUNCTION binary_search(list, target)
    low  <- 0
    high <- LENGTH(list) - 1

    WHILE low <= high
        middle <- (low + high) DIV 2

        IF list[middle] = target THEN
            RETURN middle           // found it
        ELSE IF list[middle] < target THEN
            low <- middle + 1       // target must be to the right
        ELSE
            high <- middle - 1      // target must be to the left
        END IF
    END WHILE

    RETURN NOT_FOUND                // low and high crossed: not here
END FUNCTION
```

Three details are worth noticing, because they are where ports go wrong:

1. **The loop condition is `low <= high`.** Both markers point into the
   still-possible region, inclusive on both ends. When `low` passes
   `high`, the region is empty and the target is not in the list.
2. **`DIV` is integer division.** `(low + high) DIV 2` rounds down, which
   is exactly what you want: the middle index of a 10-element list is 4,
   not 4.5.
3. **The discard lines never skip anything.** `middle` has already been
   examined, so the new window starts at `middle + 1` or ends at
   `middle - 1`. Off-by-one errors live and die on these two lines.

Hold that middle line in your mind. `(low + high) DIV 2` looks so innocent
that it fooled professional programmers for decades. We will come back to
it.

## A Step-By-Step Trace

Suppose we search this 10-element list for the value 23:

```text
list = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]    target = 23

low=0, high=9, middle=4    list[4] = 16 < 23    go right, low  = 5
low=5, high=9, middle=7    list[7] = 56 > 23    go left,  high = 6
low=5, high=6, middle=5    list[5] = 23 = 23    found at index 5
```

Three comparisons, and the element is found. If we had searched for 24
instead, the same path would have played out until `low` passed `high`
(low=6, high=5), the loop would have exited, and we would have returned
NOT_FOUND. The same bounded number of steps either finds the value or
proves it is not there, which is exactly what you want from a search.

## Why It Is So Fast

Every comparison halves the remaining search space, and halving is
brutally effective. Start with n elements and count how many times you can
cut the list in two before one element remains: that count is $\log_2(n)$.
The worst case adds one more comparison, so binary search makes about
$\log_2(n) + 1$ comparisons on any input.

Put that next to a plain linear scan, which may have to look at every
element:

| n             | Linear scan (worst) | Binary search (worst) |
| ------------- | ------------------- | --------------------- |
| 10            | 10                  | 4                     |
| 1,000         | 1,000               | 10                    |
| 1,000,000     | 1,000,000           | 20                    |
| 1,000,000,000 | 1,000,000,000       | 30                    |

Read that table from the bottom up. A list a billion entries long takes
thirty comparisons. Doubling the size of your data adds exactly one
comparison. That is the entire appeal of the algorithm, and it is why
"sorted, then searched repeatedly" is one of the most cost-effective
arrangements in computing.

The honest caveat is the sorting itself. Sorting costs O(n log n) even
with the fast algorithms, inserting into the middle of a sorted array
costs O(n), and a linear scan costs O(n) per lookup with no setup at all.
So binary search is a bet: you pay once to sort (or you inherit sorted
data, which timestamps, IDs, log files, and dictionaries frequently are),
and then every lookup is nearly free. If you search once, scan. If you
search a thousand times, sort and halve.

## When To Reach For It (and When Not To)

Binary search earns its keep in a handful of recurring situations:

- **Sorted data, repeated lookups.** Price tiers, configuration
  breakpoints, glossaries, range maps: anywhere a sorted table gets
  queried many times.
- **Finding insertion points.** "Where would this value go?" is a binary
  search over the gaps, and it runs in $\log_2(n)$. This is what Python's
  `bisect` module does, and what `lower_bound` does in C++.
- **Anything with a threshold.** The first log entry after a timestamp,
  the smallest capacity that fits, the largest timeout that still passes.
  If a yes/no question flips monotonically as you sweep a parameter, you
  can binary search the parameter itself.
- **Debugging.** `git bisect` binary-searches commit history to find the
  first broken commit. The same move works on your own systems: when a
  bug appears "somewhere between builds," check the middle.

And the situations where it is the wrong tool:

- **One or two lookups on unsorted data.** A linear scan is simpler and
  faster once you count the sort you would have to do first.
- **Data without cheap random access.** On a linked list, reaching the
  middle element is itself O(n), and the halving advantage evaporates.
- **Collections that churn.** If inserts and deletes land every other
  step, keeping the array sorted costs O(n) each time; a hash table or a
  balanced tree is a better home for the data.
- **Tiny inputs.** Under a few dozen elements, the difference between 3
  comparisons and 30 is noise, and the scan is easier to get right.

## The Famous Bug

Binary search has one of the great track records in computer science, and
not in a good way. The idea was first published in 1946.[^1] According to
Jon Bentley, the first published version that worked for every array size
did not appear until 1962: sixteen years to debug two lines of code.[^2]
When Bentley handed the problem to professional programmers, most of them
with hours to work on it, about 90 percent turned in a buggy version.[^3]
Knuth put it plainly: "Although the basic idea of binary search is
comparatively straightforward, the details can be surprisingly tricky."[^4]

Here is where the details bite. Consider that innocent middle line one
more time, as it would appear in a language with fixed-width integers:

```text
middle <- (low + high) DIV 2
```

In Java, C, or Rust, array indices fit in a fixed-size integer with a hard
maximum. `low` and `high` are each small and harmless, but their _sum_ is
not bounded by either. Search an array of a billion entries for a value
that lives near the top, and `low + high` climbs past the maximum. The sum
overflows, wraps around to a negative number, `DIV 2` keeps it negative,
and the algorithm starts indexing into nowhere. Depending on the language,
you get an exception, garbage, or a silent wrong answer.

This is not a hypothetical. Joshua Bloch, who wrote Java's
`Arrays.binarySearch`, discovered in 2006 that the overflow bug had been
sitting in the Java standard library for nine years.[^5] A billion-entry
array sounds exotic until you remember that hardware had already caught up
when he wrote about it. The fix is one line:

```text
middle <- low + ((high - low) DIV 2)
```

Since `low <= high`, the difference `high - low` is never negative, and
`low` plus that difference can never exceed `high`, so nothing can
overflow. (Java also permits `(low + high) >>> 1`, an unsigned shift that
dodges the sign bit, but the subtraction form is clearer and ports
everywhere.)

Go back to the pseudocode above and fix your mental copy of the middle
line. That line is the most famous bug in the history of this algorithm,
and it is now yours to avoid.

## Porting It To Any Language

The pseudocode above is the whole algorithm, and it ports to essentially
any language you are comfortable with. The shape, an invariant plus a
halving loop, is the algorithm; everything else is translation. These are
the differences you will meet:

- **Indexing.** I wrote the pseudocode 0-based to match Python, C, Rust,
  and friends. A 1-based language only changes the starting seeds.
- **Integer division.** `DIV` becomes `//` in Python, plain `/` on
  integers in C, Rust, and Java, or `>> 1` if you like shift operators.
- **Bounds style.** My window is inclusive on both ends. Half the world's
  libraries write an exclusive high bound instead (Python ranges, C++
  iterators), in which case the loop condition becomes `low < high` and
  the left discard becomes `high <- middle`.
- **Fixed-width integers.** The overflow from the last section only
  exists in languages with bounded integers. Python's integers are
  unbounded, so `(low + high) // 2` is safe there, but I would still
  write the subtraction form: it costs nothing, and your fingers remember
  it the next time you write Rust or C.
- **Recursion or loop.** Binary search recurses into itself beautifully,
  and the recursive version is a lovely teaching tool. In production, the
  loop is the standard form: it does not grow the call stack, and it maps
  directly onto the pseudocode.
- **Reporting misses.** Python returns `-1` by convention, Rust returns
  `None`, and C returns `NULL` or an end iterator. The algorithm is
  identical; only the error-reporting idiom changes.

Here is the same algorithm in Python:

```python
def binary_search(items, target):
    low = 0
    high = len(items) - 1

    while low <= high:
        middle = low + (high - low) // 2

        if items[middle] == target:
            return middle        # found it
        elif items[middle] < target:
            low = middle + 1     # target is to the right
        else:
            high = middle - 1    # target is to the left

    return -1                    # not present
```

And in Rust, where two small realities change the shape: `usize` is
unsigned, so `high = middle - 1` would underflow when `middle` is 0, and
`len() - 1` would break on an empty slice. The idiomatic fix is the
exclusive high bound from the checklist above, which eliminates both
problems:

```rust
fn binary_search(items: &[i64], target: i64) -> Option<usize> {
    // Exclusive upper bound: high is one past the last candidate.
    let mut low: usize = 0;
    let mut high: usize = items.len();

    while low < high {
        let middle = low + (high - low) / 2;

        if items[middle] == target {
            return Some(middle);   // found it
        } else if items[middle] < target {
            low = middle + 1;      // target is to the right
        } else {
            high = middle;         // target is to the left (exclusive!)
        }
    }

    None // not present
}
```

Same invariant, same halving, same discard lines, different bookkeeping.
Once you can see the pseudocode inside a language you have never used, you
know the algorithm for good.

## Conclusion

Binary search is one of the few algorithms you can hold entirely in your
head: one invariant (the target is somewhere between `low` and `high`),
one action (compare the middle, discard half), one guarantee (about $\log_2(n)$
comparisons). It is also older and trickier than it looks, with a
history of sixteen-year gaps and 90 percent failure rates among
professionals, so if the off-by-one details ever feel hard, you are in
excellent company.

The deeper lesson generalizes. Whenever you can arrange a problem so that
one comparison rules out half of the remaining possibilities, you are
doing binary search, whether the thing being halved is an array, a commit
history, or a range of candidate answers. Your standard library almost
certainly ships a battle-tested version, so reach for it. But now you know
when to reach for it, why the middle line is written the way it is, and
what to check when someone hands you a homegrown one.

[^1]: John Mauchly is credited with the first published discussion of binary search, in the Moore School Lectures (1946).
[^2]: Jon Bentley, _Programming Pearls_ (Boston: Addison-Wesley, 2000), column 4, "Writing Correct Programs."
[^3]: Jon Bentley, _Programming Pearls_, column 4: of the professional programmers he assigned the problem, only about 10 percent produced a correct binary search.
[^4]: Donald E. Knuth, _The Art of Computer Programming, Volume 3: Sorting and Searching_ (2nd ed., Reading: Addison-Wesley, 1998), section 6.2.1.
[^5]: Joshua Bloch, "Extra, Extra - Read All About It: Nearly All Binary Searches and Mergesorts Are Broken," Google Research Blog (June 2006). The overflow had been present in java.util.Arrays.binarySearch since 1997.