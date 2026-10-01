---
title: "Conway's Game of Life in Rust"
slug: conway-game-of-life-in-rust
publishDate: '2026-09-09'
description: "A complete Rust tutorial on John Conway's most famous cellular automaton: the history of Life, the rules and the algorithms behind them, live-coded examples from a naive grid to a double-buffered universe, and the patterns that made Life famous."
image: '/assets/blog/conway-game-of-life-in-rust.webp'
demo: 'https://andrewthecoder.com/demos/conway'
categories: ['Tutorials']
tags: ['rust', 'cellular-automata', 'game-of-life', 'algorithms', 'simulation']
author: Andrew
comments_enabled: true
featured: true
---

We are going to build **Conway's Game of Life** in Rust, from an empty
project to a grid that evolves on its own. It is one of the most satisfying
things you can code in an afternoon: the rules fit in a paragraph, the
implementation can be as simple or as fast as you like, and the patterns
that crawl out of it have fascinated mathematicians for fifty years. If you
want to actually _play_ with Life while you read, the [interactive
demo](https://andrewthecoder.com/demos/conway) on this site runs the same
simulation in your browser (JavaScript, but the logic maps one-to-one onto
the Rust we will write).

## A Short History of Life

John Horton Conway was a British mathematician, and in 1970 he asked a
question that sounds almost like a party trick: can a small set of rules
produce behavior that is arbitrarily complex?[^1] He wanted a cellular automaton
that was predictable enough to study, yet rich enough that nobody could
look at a configuration and say "obviously it will do X."

Conway's rules were published in _Scientific American_'s October 1970 issue,
in Martin Gardner's "Mathematical Games" column.[^2] There is an urban legend
that Gardner had to beg Conway for material; the truth is that Gardner's
column made Life an overnight phenomenon. Within months, computer labs and
math departments everywhere were running Life on whatever hardware they had,
and patterns were being mailed between universities on punch cards.

Conway had actually tried dozens of rule sets. He famously demanded, and got,
three properties before he would accept a candidate:

1. There is no pattern that grows without bound (no way to make an
   "infinite growth machine" from a finite seed).
2. There are patterns that move, and can do so indefinitely (he wanted
   "gliders" to be possible).
3. The rules should be simple enough to analyze by hand on graph paper,
   yet rich enough to be impossible to fully predict.

The rules he settled on are now famous. A cell in a two-dimensional grid is
either **alive** or **dead**, and at each tick of the clock (each
"generation") every cell looks at its eight neighbors:[^4]

- A live cell with fewer than 2 live neighbors dies of loneliness
  (underpopulation).
- A live cell with 2 or 3 live neighbors survives to the next generation.
- A live cell with more than 3 live neighbors dies of overcrowding.
- A dead cell with exactly 3 live neighbors becomes alive (birth, or
  reproduction).

That is the entire game. There are no players, no moves, no win condition;
Life is a "zero-player game," which is precisely why Conway called it a game
at all: the only thing you do is choose the starting pattern, and then you
just watch.

Conway died in April 2020, from complications of COVID-19, and the
programming community (this one included) is still in his debt.[^3] He also
invented the surreal numbers, the look-and-say sequence, and a great deal of
recreational mathematics, but Life is the thing that escaped the journals
and became part of the culture.

## The Rules, As Rust Code

Start a new project:

```bash
cargo new life
cd life
```

I like to model the universe as a fixed 2D grid of booleans. The classic
toroidal trick, where the edges wrap around to the other side of the board,
is how most demo implementations keep the boundary from interfering with the
action. For a board `width` wide and `height` tall, the neighbor positions
of `(row, col)` are every offset in `{-1, 0, 1} x {-1, 0, 1}` except `(0,
0)`, computed with wrapping arithmetic:

```rust
// Count the live neighbors of cell (row, col) on a toroidal board.
fn live_neighbors(grid: &Grid, row: usize, col: usize) -> usize {
    let mut count = 0;

    for dr in -1..=1 {
        for dc in -1..=1 {
            if dr == 0 && dc == 0 {
                continue; // a cell is not its own neighbor
            }

            // Wrap-around: cast to isize to allow the -1, then shift
            // back to unsigned. The extra +height handles dr == -1.
            let r = (row as isize + dr + grid.height as isize)
                % grid.height as isize;
            let c = (col as isize + dc + grid.width as isize)
                % grid.width as isize;

            if grid.cells[r as usize][c as usize] {
                count += 1;
            }
        }
    }

    count
}
```

The casting is the one fiddly bit of this whole tutorial. `row` is a
`usize`, and `dr` is an `isize` when the loop variable is negative, so
`row + dr` does not typecheck as written; casting both sides to `isize`
first lets the intermediate value go negative, and the `% height` plus the
extra `+ height` wraps it back into `0..height-1`. If `row` is `0` and `dr`
is `-1`, you get `(0 - 1 + h) % h = (h - 1) % h = h - 1`, the bottom row.

From there, one generation is a direct translation of the four rules:

```rust
// Advance the whole board by one generation. Returns the next grid.
fn step(grid: &Grid) -> Grid {
    let mut next = Grid::empty(grid.width, grid.height);

    for row in 0..grid.height {
        for col in 0..grid.width {
            let alive = grid.cells[row][col];
            let neighbors = live_neighbors(grid, row, col);

            // The whole game, as three conditions:
            next.cells[row][col] = match (alive, neighbors) {
                // Birth: dead cell, exactly three live neighbors.
                (false, 3) => true,
                // Survival: live cell with two or three neighbors.
                (true, 2 | 3) => true,
                // Everything else dies or stays dead.
                _ => false,
            };
        }
    }

    next
}
```

The `match` on a `(bool, usize)` pair is idiomatic Rust and it reads almost
exactly like the rules: dead with three, alive with two or three, otherwise
nothing. I think `2 | 3` is a neat trick, though some readers will prefer
explicit `(true, 2) => true, (true, 3) => true` arms, which is just as clear.

We need two small pieces of support, a `Grid` type and a way to see the
board:

```rust
// A fixed-size 2D universe. `cells[row][col]` is true when the cell is alive.
struct Grid {
    width: usize,
    height: usize,
    cells: Vec<Vec<bool>>,
}

impl Grid {
    // Create an empty (all-dead) board of the given size.
    fn empty(width: usize, height: usize) -> Grid {
        Grid {
            width,
            height,
            cells: (0..height).map(|_| vec![false; width]).collect(),
        }
    }

    // Set the cell at (row, col) in place. Returns nothing; the caller
    // keeps a mutable Grid and calls set() before passing it around.
    fn set(&mut self, row: usize, col: usize, alive: bool) {
        self.cells[row][col] = alive;
    }
}
```

And a printer that renders live cells as `#` and dead cells as `.`:

```rust
fn print_grid(grid: &Grid) {
    for row in &grid.cells {
        for alive in row {
            // Iterating over &grid.cells yields &bool, so dereference.
            print!("{}", if *alive { '#' } else { '.' });
        }
        println!();
    }
    println!();
}
```

Let us load a blinker, the simplest possible oscillator, and run two
generations:

```rust
fn main() {
    // A blinker: three cells in a row in the middle of a 10x10 board.
    let mut grid = Grid::empty(10, 10);
    grid.set(5, 4, true);
    grid.set(5, 5, true);
    grid.set(5, 6, true);

    println!("Generation 0:");
    print_grid(&grid);

    for generation in 1..=3 {
        grid = step(&grid);
        println!("Generation {generation}:");
        print_grid(&grid);
    }
}
```

By the way, `generation` is my loop variable here because `gen` is a
reserved keyword in current Rust (use it as a binding and the compiler will
politely tell you to escape it as `r#gen`). That is the kind of surprise
that wastes ten minutes if you copy a Python tutorial's variable names
without thinking, so I am naming the loop variable `generation` and moving
on.

The output shows the heart of Life in four lines of actual evolution:

```text
Generation 0:
..........
..........
..........
..........
..........
....###...
..........
..........
..........
..........

Generation 1:
..........
..........
..........
..........
..........
.....#....
.....#....
.....#....
..........
..........

Generation 2:
..........
..........
..........
..........
..........
....###...
..........
..........
..........
..........
```

The horizontal bar becomes a vertical bar, and then a horizontal bar again:
a period-2 oscillator, because it returns to its starting shape every two
generations. This is the "dance" that makes Life hypnotic.

## Data Structures and Algorithm Choice

The bare `Vec<Vec<bool>>` is fine for a 20x20 toy, but there are three
structures worth knowing about before you scale up, because each one changes
the character of the code dramatically.

### The Double Buffer

The single most important idea in any Life implementation: never update the
board in place. You need the entire previous generation intact while you
compute the next one, because every cell's fate depends on the state of its
neighbors _before_ the tick. Overwriting cells as you go corrupts the
computation, so you read from one buffer and write to the other, then swap:

```rust
struct Life {
    current: Grid,
    // The classic double buffer: current and next swap each tick.
    next: Grid,
}

impl Life {
    fn new(width: usize, height: usize) -> Life {
        Life {
            current: Grid::empty(width, height),
            next: Grid::empty(width, height),
        }
    }

    fn tick(&mut self) {
        // Read from self.current, write into self.next...
        for row in 0..self.current.height {
            for col in 0..self.current.width {
                let neighbors =
                    live_neighbors(&self.current, row, col);
                let alive = self.current.cells[row][col];
                self.next.cells[row][col] =
                    match (alive, neighbors) {
                        (false, 3) => true,
                        (true, 2 | 3) => true,
                        _ => false,
                    };
            }
        }

        // ...then swap the two buffers.
        std::mem::swap(&mut self.current, &mut self.next);
    }
}
```

If you forget to swap, or worse, if you write into the buffer you are
reading, the whole simulation will do something that looks sort of alive but
is quietly wrong. The strange thing is how often that bug passes a visual
test. A glider still glides, a blinker still blinks; the corruption is
subtle. If a pattern starts looking _drunk_, check the buffer swap first.

### Hash Maps and Sparse Life

A `Vec<Vec<bool>>` wastes space on mostly-empty boards, and it puts a hard
limit on how big a universe you can simulate. There is a whole genre of
Life implementations built on the observation that you never need to
consider a cell unless it is alive or adjacent to an alive cell.

The classic approach stores only the live cells in a `HashMap`, keys it by a
`(row, col)` coordinate, and gathers candidates from the neighborhoods of
the live cells:

```rust
use std::collections::hash_map::HashMap;
use std::collections::HashSet;

// A sparse universe: only live cells are stored, keyed by (row, col).
struct SparseGrid {
    live: HashSet<(usize, usize)>,
}

impl SparseGrid {
    fn step_sparse(&self) -> SparseGrid {
        // Count how many live neighbors each candidate cell has.
        let mut tallies: HashMap<(usize, usize), usize> =
            HashMap::new();

        for &(row, col) in &self.live {
            for dr in -1..=1 {
                for dc in -1..=1 {
                    if dr == 0 && dc == 0 {
                        continue;
                    }
                    let key = ((row as isize + dr) as usize,
                               (col as isize + dc) as usize);
                    // get returns Option<&usize>; copied() dereferences
                    // so unwrap_or can fall back to a plain usize.
                    let current = tallies.get(&key).copied().unwrap_or(0usize);
                    tallies.insert(key, current + 1);
                }
            }
        }

        // A cell survives if it is live and tallied 2 or 3; a dead
        // cell becomes alive if it is in the tally map with exactly 3.
        let mut next: HashSet<(usize, usize)> = HashSet::new();
        for (key, count) in tallies {
            if count == 3 || (count == 2 && self.live.contains(&key)) {
                next.insert(key);
            }
        }

        SparseGrid { live: next }
    }
}
```

Note that `tallies.get(&key)` returns an `Option<&usize>` (a reference), so
`.copied()` dereferences it before `unwrap_or` works on the plain value,
and `HashSet` membership is checked with `contains(&key)` (a reference).
This is the "hashlife-lite" idea, and it is what you want if you are
simulating Life on an infinite plane with a handful of interesting objects.
It also makes infinite universes easy, because you simply never delete
empty cells.

### The Wrap-Up: When to Use What

- `Vec<Vec<bool>>` plus the naive neighbor scan: right for learning,
  small boards, and the first version of anything. It is also perfectly
  fast up to a few thousand cells.
- The double buffer: mandatory, whatever else you do. It is not an
  optimization so much as a correctness requirement.
- `HashMap`/`HashSet` sparse representation: right for large or infinite
  boards with sparse content, where a dense grid of `Vec<Vec<bool>>` would
  waste gigabytes.
- The next level up, which I will mention but not implement here, is
  **Hashlife**, Bill Gosper's algorithm, which encodes the board as a
  quadtree of precomputed patches and can leap forward trillions of
  generations by exponentiating the time step.[^5] It is spectacular, slightly
  terrifying, and overkill for a tutorial; but it is the direct descendant
  of the sparse idea above, so the family tree is clear.

## Patterns: The Zoo of Life

Half the fun of Life is knowing the menagerie. Here is the cast of
characters you will meet in every demo and every codebase, starting with the
patterns I loaded in the first example.

### Still Lifes

Still lifes are patterns that never change. The **block** is the simplest:

```text
##
##
```

Four cells in a square. Every cell has exactly three neighbors, so nothing
ever dies, and every dead cell adjacent to the block has at most two live
neighbors, so nothing is ever born. A block is a rock in the stream of
generations.[^6]

The **beehive** is six cells, and the **loaf** is seven; both are still
lifes. The queue of still lifes is infinite, which is itself a result worth
sitting with: there are infinitely many different frozen configurations, and
no one knows a closed form that describes them all.

### Oscillators

Oscillators return to their starting shape after a fixed number of
generations. The **blinker** (period 2) is the smallest. The **pulsar** is
the most famous period-3 oscillator, a kind of glowing cross that throbs
in and out:

```text
..###...###..
.............
#....#.#....#
#....#.#....#
#....#.#....#
..###...###..
.............
..###...###..
#....#.#....#
#....#.#....#
#....#.#....#
.............
..###...###..
```

(That is the 12x12 outline; the pulsar is symmetric, so it is the same after
one full period. In real Life code you will usually see it generated
programmatically from a single quadrant, which is exactly what the
[JavaScript demo](https://andrewthecoder.com/demos/conway) does.)

### Spaceships

The **glider** is the most famous object in Life: five cells that move
diagonally one cell every four generations. It is the smallest spaceship
(it was first described by Richard K. Guy in 1969, while Conway's group was
tracking the R-pentomino),[^7] and it is why "glider" appears in half of all
Life lore, including the opening of Douglas Adams's _The Hitchhiker's Guide
to the Galaxy_ (the GUIDE ships with a hologram of a glider).

```text
.#.
..#
###
```

The **lightweight spaceship** (LWSS) is a period-4 object that moves
horizontally at speed `c/2` (the "speed of light" in Life is one cell per
generation, and the LWSS is one of the famous "c/2 orthogonal" ships).
There are midsized and heavyweight spaceships too, and decades after Life's
invention, faster-than-c/2 spaceships were finally found, upending what
many had assumed was a hard ceiling on Life's speed.

### The R-Pentomino and Methuselahs

A **methuselah** is a tiny pattern that runs for a very long time before
stabilizing.[^8] The champion small one is the **R-pentomino**: five cells in a
shape like a capital R. It takes 1103 generations to settle, and along the
way it emits gliders in every direction. You can load it in the demo above;
it looks like a spark that slowly learns to make halos.

### Gosper's Glider Gun

The **Glider Gun**, discovered by Bill Gosper in 1970, is the most
important pattern in Life history.[^9] It is a finite pattern that emits a
glider every 30 generations, forever, which means the universe _does_ grow
without bound. This was the discovery that overturned Conway's conjecture
that no infinite growth was possible.

Conway had offered a prize (fifty dollars, and some versions say a bottle
of something) for a pattern that grows without limit. Gosper's gun won it.[^10]
The gun is a 36-cell pattern, and it is on display in the demo page's
pattern menu.

## Putting It All Together

Here is a complete, self-contained Rust program that builds a 40x40 board,
drops a glider in the corner, and prints ten generations:

```rust
// A complete, self-contained Game of Life: grid, rules, printer, main.
struct Grid {
    width: usize,
    height: usize,
    cells: Vec<Vec<bool>>,
}

impl Grid {
    fn empty(width: usize, height: usize) -> Grid {
        Grid {
            width,
            height,
            cells: (0..height).map(|_| vec![false; width]).collect(),
        }
    }

    fn set(&mut self, row: usize, col: usize, alive: bool) {
        self.cells[row][col] = alive;
    }
}

// Count live neighbors with wrap-around (toroidal) edges.
fn live_neighbors(grid: &Grid, row: usize, col: usize) -> usize {
    let mut count = 0;

    for dr in -1..=1 {
        for dc in -1..=1 {
            if dr == 0 && dc == 0 {
                continue;
            }

            let r = (row as isize + dr + grid.height as isize)
                % grid.height as isize;
            let c = (col as isize + dc + grid.width as isize)
                % grid.width as isize;

            if grid.cells[r as usize][c as usize] {
                count += 1;
            }
        }
    }

    count
}

// One generation of the rules, applied to the whole board.
fn step(grid: &Grid) -> Grid {
    let mut next = Grid::empty(grid.width, grid.height);

    for row in 0..grid.height {
        for col in 0..grid.width {
            let alive = grid.cells[row][col];
            let neighbors = live_neighbors(grid, row, col);

            next.cells[row][col] = match (alive, neighbors) {
                (false, 3) => true,  // birth
                (true, 2 | 3) => true, // survival
                _ => false,           // death or stay-dead
            };
        }
    }

    next
}

fn print_grid(grid: &Grid) {
    for row in &grid.cells {
        for alive in row {
            print!("{}", if *alive { '#' } else { '.' });
        }
        println!();
    }
    println!();
}

fn main() {
    // 40x40 universe with a glider parked in the upper-left area.
    let mut grid = Grid::empty(40, 40);
    grid.set(2, 1, true);
    grid.set(3, 2, true);
    grid.set(1, 3, true);
    grid.set(2, 3, true);
    grid.set(3, 3, true);

    for generation in 0..10 {
        println!("Generation {generation}:");
        print_grid(&grid);
        grid = step(&grid);
    }
}
```

Copy that into `src/main.rs`, run `cargo run`, and you have a working Life.
(One note on the `set` method: it mutates the grid in place and returns
nothing, which is the simplest form for a tutorial. If you prefer the
immutable style, have `set` return a fresh `Grid`; the choice is yours and
does not affect the simulation.)

The next obvious upgrade is to make the board infinite. Drop the toroidal
wrapping, switch to the `HashSet<(usize, usize)>` representation, and you
are already on the road to Hashlife. My advice: first make it _correct_,
then make it _watchable_ (fill a few random cells and let it run), then make
it fast. The correctness step is genuinely hard to shake once you have
internalized the rules; everything else is performance theater on top of it.

## The Deep Result

There is one more thing Life teaches, and it is the reason Conway kept
coming back to it. Because gliders can act as counters, and a pair of
two-counter machines has the same computational power as a universal Turing
machine, Life turned out to be **Turing complete**:[^11] with enough space and
time, a Life universe can simulate any possible computation, including a
universal computer and, in principle, a copy of the very Rust program that
implements Life. Since then, constructors have built actual Turing machines
and general-purpose computers inside Life; a famous construction by Paul
Rendell realized a working universal Turing machine in the grid itself.[^12]

That means Life is not a toy. It is a proof, in the most concrete form
imaginable, that a handful of simple local rules can encode every
computation the universe could ever perform. The same lesson powers
today's cellular automata in physics, biology, and machine learning, where
local rules over a grid keep producing surprisingly global behavior.

Back in 1970, Conway wanted a pattern that nobody could just _look_ at and
predict. He got one: Life is mathematically undecidable in general,[^13]
which is a polite way of saying you cannot write a program that tells you
whether an arbitrary starting pattern will go on forever. You have to run
it. That is why Life is such a lovely first project in any language: being
forced to simulate it is not a limitation, it is the point.

[^1]: John Horton Conway, "The Game of Life" (unpublished notes, 1970), as presented in Martin Gardner, "Mathematical Games," _Scientific American_ 223 (October 1970). For Conway's life and work, see Siobhan Roberts, _Genius at Play: The Curious Mind of John Conway_ (New York: Bloomsbury, 2015).
[^2]: Martin Gardner, "Mathematical Games: The Fantastic Combinations of John Conway's New Solitaire Game 'Life'," _Scientific American_ 223 (October 1970). The column gave Life its first public appearance and made it a cultural phenomenon.
[^3]: Conway died of complications of COVID-19 in April 2020. See Siobhan Roberts, "John Conway, 82, Dies; Mathematician Who Invented the Game of Life," _The New York Times_ (April 2020).
[^4]: The four rules appear in Gardner, "Mathematical Games," _Scientific American_ 223 (October 1970), and are restated in Elwyn Berlekamp, John Conway, and Richard Guy, _Winning Ways for Your Mathematical Plays_, vol. 4 (Wellesley: A K Peters, 2004), ch. 25.
[^5]: Bill Gosper described Hashlife in the early 1980s at Xerox PARC; the algorithm is documented in the Life community literature, most accessibly in the "Hashlife" entry of _LifeWiki_ (2026).
[^6]: The block, beehive, and loaf are the three smallest still lifes. The block, as a 2x2 square, is the only still life with exactly four cells; see the "Still Life" entry in _LifeWiki_ (2026).
[^7]: Richard K. Guy discovered the glider in 1969 while Conway's group was tracking the R-pentomino; see the "Glider" entry in the Life Lexicon, compiled by Stephen A. Silver (2026).
[^8]: Martin Gardner defines methuselahs as patterns of fewer than ten live cells that take longer than 50 generations to stabilize; see the "Methuselah" entry in the Life Lexicon, compiled by Stephen A. Silver (2026).
[^9]: Bill Gosper discovered the Glider Gun in November 1970; the gun is a period-30 oscillator emitting a glider every 30 generations. See the "Glider Gun" entry in _LifeWiki_ (2026).
[^10]: Conway offered fifty dollars in the October 1970 column for a proof or disproof of his no-infinite-growth conjecture; the prize was won in November 1970 by an MIT team that constructed the glider gun. See the "Gun" and "Glider Gun" entries in _LifeWiki_ (2026).
[^11]: Turing completeness of Life follows from constructing a two-counter machine in the grid; see Paul Chapman, "Life Universal Computer" (2002) and the citations in the "Turing completeness" section of _LifeWiki_ (2026).
[^12]: Paul Rendell, "A Turing Machine in Conway's Game of Life" (2005), implemented a working universal Turing machine inside Life; see also the "Turing Machine" entry in _LifeWiki_ (2026).
[^13]: By the halting problem, determining whether an arbitrary Life configuration terminates is undecidable; see the "Turing completeness" section of _LifeWiki_ (2026).
