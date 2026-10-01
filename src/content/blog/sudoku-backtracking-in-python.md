---
title: 'Solving Sudoku with Backtracking in Python'
slug: sudoku-backtracking-in-python
publishDate: '2026-09-08'
description: 'A step-by-step Python tutorial on solving Sudoku puzzles with recursive backtracking: the board model, validity checks, search, solution counting, and a generator that proves uniqueness.'
image: '/assets/blog/sudoku-backtracking-in-python.webp'
demo: 'https://andrewthecoder.com/demos/sudoku'
categories: ['Tutorials']
tags: ['python', 'backtracking', 'sudoku', 'algorithms', 'recursion']
author: Andrew
comments_enabled: true
featured: true
---

Sudoku is one of those puzzles that feels like pure logic when you solve it by
hand, and pure magic when a computer does it in milliseconds. The magic has a
name: **backtracking**. It is a general search technique that tries a
candidate, and when the candidate leads nowhere, it takes the candidate back
and tries the next one. This post walks through a complete Python solver from
scratch, step by step, so you can see exactly how the recursion works and why
it is so fast in practice.

This post walks through a complete Python solver from scratch, step by step,
so you can see exactly how the recursion works and why it is so fast in
practice. You can also play with a live, interactive version of exactly this
solver on the [sudoku demo](https://andrewthecoder.com/demos/sudoku) page,
which runs the same backtracking logic in your browser.

## The Board

A Sudoku board is a 9x9 grid. I represent it as a list of nine rows, each row
a list of nine integers, with `0` standing for an empty cell.

```python
board = [
    [5, 3, 0, 0, 7, 0, 0, 0, 0],
    [6, 0, 0, 1, 9, 5, 0, 0, 0],
    [0, 9, 8, 0, 0, 0, 0, 6, 0],
    [8, 0, 0, 0, 6, 0, 0, 0, 3],
    [4, 0, 0, 8, 0, 3, 0, 0, 1],
    [7, 0, 0, 0, 2, 0, 0, 0, 6],
    [0, 6, 0, 0, 0, 0, 2, 8, 0],
    [0, 0, 0, 4, 1, 9, 0, 0, 5],
    [0, 0, 0, 0, 8, 0, 0, 7, 9],
]
```

Before searching, it helps to be able to see the board. A little printer makes
debugging much less painful:

```python
def print_board(board):
    for i, row in enumerate(board):
        if i % 3 == 0 and i != 0:
            print("-" * 21)
        line = []
        for j, cell in enumerate(row):
            if j % 3 == 0 and j != 0:
                line.append("|")
            line.append("·" if cell == 0 else str(cell))
        print(" ".join(line))
```

That gives you the familiar Sudoku look:

```text
5 3 · | · 7 · | · · ·
6 · · | 1 9 5 | · · ·
· 9 8 | · · · | · 6 ·
--------------------- (truncated for space)
```

## The Rules, As Code

The only thing that makes a move legal is the rules of Sudoku: no repeats in a
row, a column, or a 3x3 box. Checking a candidate `num` at position `(row,
col)` is three short scans:

```python
def is_valid(board, row, col, num):
    # Row
    if num in board[row]:
        return False

    # Column
    if num in [board[r][col] for r in range(9)]:
        return False

    # 3x3 box
    box_row = (row // 3) * 3
    box_col = (col // 3) * 3
    for r in range(box_row, box_row + 3):
        for c in range(box_col, box_col + 3):
            if board[r][c] == num:
                return False

    return True
```

Note the box math: `// 3` maps a row index to which band of boxes it belongs
to (0, 1, or 2), and `* 3` gives the actual starting row of that band. The
same trick works for columns.

## The Search

Now the heart of it. The solver scans for the first empty cell, tries numbers
1 through 9 there, and recurses. If the recursion reaches a board with no
empty cells, we are done. If a number leads to a dead end, we undo it (set
the cell back to `0`) and try the next one. That undo is where the name
comes from: you backtrack.

```python
def solve(board):
    # Find the first empty cell; None means we are done.
    empty = find_empty(board)
    if empty is None:
        return True

    row, col = empty
    for num in range(1, 10):
        if is_valid(board, row, col, num):
            board[row][col] = num  # try the move

            if solve(board):       # recurse deeper
                return True

            board[row][col] = 0    # dead end: undo (backtrack)

    return False                   # nothing worked at this cell
```

`find_empty` is a tiny helper:

```python
def find_empty(board):
    for r in range(9):
        for c in range(9):
            if board[r][c] == 0:
                return r, c
    return None
```

Notice how the recursion works. Every call to `solve` either:

1. finds an empty cell and tries its options, or
2. returns `True` because there are no empty cells left.

Because each recursive call gets its own `row` and `col` locals and the board
is mutated in place (and un-mutated on backtrack), the state is managed
entirely through the call stack. There is no global "current position" to
maintain, no explicit stack data structure. Recursion _is_ the stack.

## Why It Is Fast (If You Feed It Good Boards)

The naive complexity is astronomical: in the worst case you try `9^81`
assignments. Nobody solves boards that way. What actually happens on a normal
puzzle is that the constraints prune almost everything. Early cells have a
handful of candidates, and a wrong guess usually dies within a few levels.
For a well-formed 17- to 30-clue puzzle, this solver finishes in milliseconds
in CPython.

The one simple optimization that keeps the worst cases in check is picking
the first empty cell in row-major order. More sophisticated solvers pick the
cell with the fewest candidates (the *minimum remaining values* heuristic),
which makes even the hardest published puzzles fast. I will show that as a
bonus at the end.

## Counting Solutions

Sometimes you want to know not just whether a board is solvable, but whether
it has *exactly one* solution. That matters if you are generating puzzles,
because a puzzle with multiple solutions is a broken puzzle.

The trick is to turn `solve` into a generator that yields each completed
board instead of returning on the first one:

```python
def solve_all(board):
    empty = find_empty(board)
    if empty is None:
        yield [row[:] for row in board]  # copy, so callers get distinct boards
        return

    row, col = empty
    for num in range(1, 10):
        if is_valid(board, row, col, num):
            board[row][col] = num
            yield from solve_all(board)
            board[row][col] = 0
```

Then counting is just:

```python
def count_solutions(board, limit=2):
    count = 0
    for _ in solve_all(board):
        count += 1
        if count >= limit:
            break
    return count
```

The `limit` is important. If all you care about is uniqueness, you stop at
the second solution. You almost never want to enumerate all of them, because
a degenerate board can have trillions.

## A Step-By-Step Trace

To really see backtracking in action, let us add a tracer. It prints every
placement and every undo, indented by recursion depth:

```python
def solve_traced(board, depth=0):
    empty = find_empty(board)
    if empty is None:
        print("  " * depth + "Solved!")
        return True

    row, col = empty
    for num in range(1, 10):
        if is_valid(board, row, col, num):
            board[row][col] = num
            print("  " * depth + f"Set ({row},{col}) = {num}")
            if solve_traced(board, depth + 1):
                return True
            board[row][col] = 0
            print("  " * depth + f"Backtrack ({row},{col})")

    return False
```

Run it on a small, nearly-empty board and you will see the pattern
immediately: the solver charges down one path, hits a wall, and unwinds,
trying the next candidate at each level. The indentation visually shows the
call stack growing and shrinking.

## Generating Puzzles With a Uniqueness Guarantee

The same machinery that solves boards also generates them. The recipe:

1. Fill a solved board by running `solve` on an empty grid (tweak `solve_all`
   to stop after the first board).
2. Remove cells one at a time.
3. After each removal, check that the board still has exactly one solution
   with `count_solutions`. If it does not, put the number back.

```python
import random

def generate_puzzle(clues=30):
    # Start from a random solved board.
    board = [[0] * 9 for _ in range(9)]
    solve(board)
    cells = [(r, c) for r in range(9) for c in range(9)]
    random.shuffle(cells)

    remaining = 81
    for r, c in cells:
        if remaining <= clues:
            break
        backup = board[r][c]
        board[r][c] = 0
        if count_solutions(board, limit=2) != 1:
            board[r][c] = backup  # removal broke uniqueness; restore
        else:
            remaining -= 1

    return board
```

`clues` is a target for how many givens you want to see at the end. The loop
stops removing once it reaches that target, though if a removal breaks
uniqueness the cell is restored, so the final board can end up with more
givens than the target. A harder puzzle has fewer clues (17 is the famous
minimum for a valid Sudoku), and the uniqueness check is what keeps the
puzzle honest.

One caveat: this generator is simple, not elegant. It can be slow for very
sparse boards, because the uniqueness check has to solve the (mostly empty)
board after every removal. For a tutorial it is perfect; for production you
would swap in a proper solver with the MRV heuristic below.

## The Minimum Remaining Values Heuristic

Earlier I promised the upgrade that makes even brutal puzzles fast. Instead
of taking the first empty cell, pick the empty cell with the fewest legal
candidates:

```python
def best_cell(board):
    best = None
    fewest = 10
    for r in range(9):
        for c in range(9):
            if board[r][c] == 0:
                candidates = [
                    n for n in range(1, 10)
                    if is_valid(board, r, c, n)
                ]
                if len(candidates) < fewest:
                    fewest = len(candidates)
                    best = (r, c, candidates)
                    if fewest == 1:
                        return best
    return best
```

Then `solve_mrv` uses `best_cell` instead of `find_empty`:

```python
def solve_mrv(board):
    cell = best_cell(board)
    if cell is None:
        return True  # no empty cells: solved

    r, c, candidates = cell
    for num in candidates:
        board[r][c] = num
        if solve_mrv(board):
            return True
        board[r][c] = 0

    return False
```

That tiny change is the difference between a solver that handles newspaper
puzzles and one that chews through AI Escargot, the famously hard Sudoku, in
a blink.

## Putting It All Together

Here is a complete, self-contained solver you can copy and run:

```python
def find_empty(board):
    for r in range(9):
        for c in range(9):
            if board[r][c] == 0:
                return r, c
    return None

def is_valid(board, row, col, num):
    if num in board[row]:
        return False
    if num in [board[r][col] for r in range(9)]:
        return False
    box_row, box_col = (row // 3) * 3, (col // 3) * 3
    for r in range(box_row, box_row + 3):
        for c in range(box_col, box_col + 3):
            if board[r][c] == num:
                return False
    return True

def solve(board):
    empty = find_empty(board)
    if empty is None:
        return True
    row, col = empty
    for num in range(1, 10):
        if is_valid(board, row, col, num):
            board[row][col] = num
            if solve(board):
                return True
            board[row][col] = 0
    return False
```

Load a puzzle, call `solve(board)`, and print `board`. That is the whole
trick: try, recurse, and when you hit a wall, undo and try again.

```python
puzzle = [...]  # your 9x9 grid, 0 for empty
if solve(puzzle):
    print_board(puzzle)
else:
    print("No solution exists.")
```

## Conclusion

Backtracking is the quiet workhorse behind a lot of programming that looks
like magic: constraint solvers, compiler pattern matching, puzzle games, and
even some pathfinding. Sudoku is a perfect playground for it because the
rules are simple, the state is small, and the payoff, a solved grid, is
immediately visible.

Start with the plain solver, add the generator, then the MRV heuristic, and
you will have built a small but complete Sudoku toolkit in about a hundred
lines of Python. The next time someone says "the computer just tries every
possibility," you will know exactly how right, and how wrong, that statement
is.