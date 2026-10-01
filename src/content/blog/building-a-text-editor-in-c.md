---
title: "Building a Text Editor in C"
slug: building-a-text-editor-in-c
publishDate: "2026-09-14"
description: "A complete C tutorial for building a terminal text editor the way the pros do it: the edit buffer, ncurses rendering, cursor movement, file I/O, find and replace, syntax highlighting, selection and clipboard, undo/redo, and a build system that keeps memory bugs out."
image: "/assets/blog/building-a-text-editor-in-c.webp"
categories: ["Tutorials"]
tags: ["c", "ncurses", "text-editor", "terminal", "undo-redo"]
author: Andrew
comments_enabled: true
featured: true
---

You can read a hundred posts about how to write a text editor, but the
shortest path to understanding one is to build it. A text editor is one of
those programs that sounds intimidating until you see how much of it is
just bookkeeping: a buffer of lines, a cursor, a screen, a set of keys. Once
you name the data structures, the rest is plumbing.

This tutorial builds a complete, working terminal text editor in C, step by
step, using ncurses. Everything here comes from a real project I have been
working on — **ErwinText** — so the code is production-shaped, not a toy. It
has a growable line buffer, cursor movement, insert and delete, file open
and save, find, syntax highlighting for six languages, selection and
clipboard support, and a 1000-step undo/redo system. The whole thing is
about 2,900 lines of C, and by the end of this post you will have built all
of it.

## Why Build an Editor at All?

Here is the argument I keep coming back to: an editor is the one tool you
use every day, and it is the one tool you are never quite happy with. Either
it is missing a feature you want, or it has a feature you keep tripping
over, or the defaults are wrong for the way you work. When you write your
own, you get to decide. My editor is called ErwinText, it lives in a
terminal, and it does exactly what I want it to do — nothing more.

A terminal editor is also one of the best ways to get comfortable with C.
It touches input handling, dynamic memory, terminal I/O, parsing, and
process management, all in a few thousand lines. It is big enough to be
real and small enough to finish.

## What We Are Building

Here is the feature list for the editor we are going to build:

- A growable array of lines as the core buffer
- A full-screen ncurses interface with a status bar and message bar
- Arrow keys, Home/End, PageUp/PageDown cursor movement
- Character insert, character delete, newline insert, line joining
- Open and save files, including new files and missing files
- Incremental find with forward/backward navigation
- Syntax highlighting for C, shell, JavaScript, HTML, CSS, and XML
- Selection with Shift+arrows, plus copy, cut, and paste through the
  system clipboard (Wayland or X11)
- Undo and redo across 1000 actions
- A Makefile with debug, release, and ThreadSanitizer builds

We are going to write it in C99 with ncurses. You need `libncurses-dev` on
Debian/Ubuntu, `ncurses` on Arch, or the system ncurses on macOS.

## Project Layout

The real project is split into small files, each owning one concern:

```text
main.c                — entry point, the main loop
editor.c              — the editor core: cursor, insert, delete, undo/redo
editor.h              — the EditorConfig struct and public API
editor_actions.c/.h   — action log records (insert, delete, newline, range)
editor_lines_array.c  — the growable array of lines
file.c                — open and save
syntax.c              — the syntax highlighter
ui.c                  — drawing, scrolling, status and message bars
error_handler.c       — error codes, logging, critical-error state
```

That split is deliberate. The line array is independent of the editor, the
syntax highlighter only touches lines, and the UI only reads the buffer.
When something breaks, you know which file to open.

## The Heart of It: A Growable Array of Lines

Every terminal editor has one essential data structure: the buffer. We
store the file as an array of lines, where each line is a heap-allocated
C string. A plain array is the right call here — text files are read and
written top to bottom, and most edits are local to a line or two. A linked
list of lines would make insertion lovely but make everything else painful,
including the renderer, which wants random access by row.

Here is the line type:

```c
typedef struct
{
    char* text;
    size_t len;
    char* hl;
    int hl_open_comment;
} EditorLine;
```

`text` is the line contents, `len` is its byte length (we keep it around so
we do not have to call `strlen` thousands of times per frame), `hl` is a
parallel array of highlight codes, and `hl_open_comment` lets the
highlighter remember that a multiline comment started on this line.

The array itself is a classic dynamic array:

```c
typedef struct
{
    EditorLine* elements;
    int size;
    int capacity;
} EditorLinesArray;
```

`size` is how many lines we actually hold; `capacity` is how many fit
before we grow. We start at 8 and double:

```c
#define EDITOR_LINES_ARRAY_INIT_CAPACITY 8

void init_editor_lines_array(EditorLinesArray* array)
{
    array->elements = malloc(sizeof(EditorLine) * EDITOR_LINES_ARRAY_INIT_CAPACITY);
    if (array->elements == NULL)
    {
        editor_handle_error(ERR_OUT_OF_MEMORY,
                            "Failed to allocate initial memory for EditorLinesArray.");
    }
    array->size = 0;
    array->capacity = EDITOR_LINES_ARRAY_INIT_CAPACITY;
}

void editor_lines_array_grow(EditorLinesArray* array)
{
    int new_capacity = array->capacity * 2;
    EditorLine* new_elements = realloc(array->elements, sizeof(EditorLine) * new_capacity);
    if (new_elements == NULL)
    {
        editor_handle_error(ERR_OUT_OF_MEMORY, "Failed to grow EditorLinesArray capacity.");
    }
    array->elements = new_elements;
    array->capacity = new_capacity;
}
```

Appending is O(1) amortized:

```c
void editor_lines_array_append(EditorLinesArray* array, EditorLine line)
{
    if (array->size == array->capacity)
    {
        editor_lines_array_grow(array);
    }
    array->elements[array->size++] = line;
}
```

Inserting in the middle shifts the rest with `memmove`, which is exactly
what we want when Enter splits a line:

```c
void editor_lines_array_insert(EditorLinesArray* array, int index, EditorLine line)
{
    if (index < 0 || index > array->size)
    {
        editor_handle_error(ERR_NONE, "Invalid index for EditorLinesArray insertion.");
        return;
    }
    if (array->size == array->capacity)
    {
        editor_lines_array_grow(array);
    }
    memmove(&array->elements[index + 1], &array->elements[index],
            (array->size - index) * sizeof(EditorLine));
    array->elements[index] = line;
    array->size++;
}
```

Deleting is the mirror image, and we also shrink the array when it gets
sparse. If you have ever wanted to know when it is worth shrinking a
dynamic array: when it has been under a quarter full, and the capacity is
above the initial size. That keeps memory from pinning at a huge peak after
a temporary paste of a large text block:

```c
void editor_lines_array_delete(EditorLinesArray* array, int index)
{
    if (index < 0 || index >= array->size)
    {
        editor_handle_error(ERR_NONE, "Invalid index for EditorLinesArray deletion.");
        return;
    }
    free(array->elements[index].text);
    free(array->elements[index].hl);
    memmove(&array->elements[index], &array->elements[index + 1],
            (array->size - index - 1) * sizeof(EditorLine));
    array->size--;

    // Shrink array if significantly underutilized
    if (array->capacity > EDITOR_LINES_ARRAY_INIT_CAPACITY && array->size < array->capacity / 4)
    {
        int new_capacity = array->capacity / 2;
        EditorLine* new_elements = realloc(array->elements, sizeof(EditorLine) * new_capacity);
        if (new_elements == NULL)
        {
            editor_handle_error(ERR_OUT_OF_MEMORY, "Failed to shrink EditorLinesArray capacity.");
        }
        array->elements = new_elements;
        array->capacity = new_capacity;
    }
}
```

Notice a subtlety: when we delete an `EditorLine`, we free both `text` and
`hl`. That `hl` pointer is easy to forget. Every line owns two allocations,
and both have to be freed everywhere a line dies — here, and in the undo
history when we drop old actions (more on that later).

## The Editor State

The editor's entire state lives in one struct. If you have used other
terminals editors you will recognize this pattern: everything you need to
draw a frame and handle a key is in one place.

```c
typedef struct
{
    EditorLinesArray lines;
    int cx, cy;
    int row_offset;
    int col_offset;
    int screen_rows, screen_cols;
    char* filename;
    int dirty;
    int select_all_active;

    int select_active;
    int sel_start_row;
    int sel_start_col;

    ClipboardTool clipboard_tool;

    EditorAction undo_history[MAX_UNDO_STATES];
    int undo_history_len;
    int undo_history_idx;

    EditorAction redo_history[MAX_UNDO_STATES];
    int redo_history_len;
    int redo_history_idx;

    char* search_query;
    int search_direction; // 1 for forward, -1 for backward
    int last_match_row;
    int last_match_col;
    bool find_active;
    bool recording_actions;
    int critical_error;
} EditorConfig;
```

`cx`/`cy` are the cursor's position in the buffer (column, row). Because
the screen may be smaller than the file, `row_offset` and `col_offset`
say how far the viewport is scrolled from the top-left of the buffer. We
also keep selection state (`select_active` and the anchor), the undo/redo
stacks, search state, and a pointer to which clipboard tool we detected.

A neat trick: we declare `static EditorConfig E;` in `editor.c` and hand
out a pointer through a getter, so the UI and file modules do not need to
know where it lives:

```c
EditorConfig* get_editor_config(void)
{
    return &E;
}
```

(If you want to be pedantic about "globals are bad": yes, there is one
global editor state, and that is the right call for an interactive app.
The alternative — passing `EditorConfig*` through every single function —
would turn a 2,900-line codebase into 4,000 lines of ceremony.)

## Entering Raw Mode with ncurses

Text editors are terminal programs that need full control of the screen.
The typical bare-metal approach is to poke at termios directly to put the
terminal into "raw mode" — disable line buffering, disable echo, disable
signal keys. The practical approach — and the one we use — is to let
ncurses do all of that for us, because ncurses also gives us color pairs,
keypad keys, mouse events, and resizing for free.

Here is the whole setup, from `init_editor`:

```c
void init_editor(void)
{
    E.cx = 0;
    E.cy = 0;
    init_editor_lines_array(&E.lines);
    E.row_offset = 0;
    E.col_offset = 0;
    E.filename = NULL;
    E.dirty = 0;
    E.select_all_active = 0;
    E.clipboard_tool = editor_detect_clipboard_tool();

    E.select_active = 0;
    E.sel_start_row = 0;
    E.sel_start_col = 0;

    E.undo_history_len = 0;
    E.undo_history_idx = 0;
    E.redo_history_len = 0;
    E.redo_history_idx = 0;
    for (int i = 0; i < MAX_UNDO_STATES; ++i)
    {
        E.undo_history[i].line_content = NULL;
        E.redo_history[i].line_content = NULL;
    }

    E.search_query = NULL;
    E.search_direction = 1;
    E.last_match_row = -1;
    E.last_match_col = -1;
    E.find_active = false;
    E.recording_actions = true;
    E.critical_error = 0;

    initscr();
    raw();
    noecho();
    keypad(stdscr, TRUE);

    getmaxyx(stdscr, E.screen_rows, E.screen_cols);
    E.screen_rows -= 2;

    if (has_colors())
    {
        start_color();
        use_default_colors();
        init_pair(HL_NORMAL, COLOR_WHITE, COLOR_BLACK);
        init_pair(HL_COMMENT, COLOR_CYAN, COLOR_BLACK);
        init_pair(HL_KEYWORD1, COLOR_YELLOW, COLOR_BLACK);
        init_pair(HL_KEYWORD2, COLOR_GREEN, COLOR_BLACK);
        init_pair(HL_STRING, COLOR_MAGENTA, COLOR_BLACK);
        init_pair(HL_NUMBER, COLOR_RED, COLOR_BLACK);
        init_pair(HL_MATCH, COLOR_BLACK, COLOR_YELLOW);
        init_pair(HL_PREPROC, COLOR_BLUE, COLOR_BLACK);
    }

    mousemask(ALL_MOUSE_EVENTS | REPORT_MOUSE_POSITION, NULL);
}
```

The order matters: `initscr()` initializes the screen, `raw()` disables
line buffering and signal interrupts, `noecho()` stops input from being
printed back, `keypad()` makes arrow keys and function keys report as
`KEY_LEFT`, `KEY_UP`, and so on. We also grab the terminal size and reserve
the bottom two rows for the status bar and message bar. And we register
our color pairs once.

`cleanup_editor` is the mirror image:

```c
void cleanup_editor(void)
{
    endwin();

    free_editor_lines_array(&E.lines);
    if (E.filename)
    {
        free(E.filename);
    }
    if (E.search_query)
    {
        free(E.search_query);
    }

    for (int i = 0; i < E.undo_history_len; ++i)
    {
        editor_action_free(&E.undo_history[i]);
    }
    for (int i = 0; i < E.redo_history_len; ++i)
    {
        editor_action_free(&E.redo_history[i]);
    }
}
```

## The Main Loop

With the screen ready, the editor settles into the classic loop: wait for
a key, handle it, redraw. That is the whole job of `main`.

```c
int main(int argc, char* argv[])
{
    E = get_editor_config();
    init_editor();

    if (argc >= 2)
    {
        editor_read_file(argv[1]);
    }
    else
    {
        init_editor_lines_array(&E->lines);
        EditorLine empty_line = {.text = strdup(""), .len = 0, .hl = NULL, .hl_open_comment = 0};
        if (empty_line.text == NULL)
        {
            editor_handle_error(ERR_OUT_OF_MEMORY, "Out of memory (main empty line text).");
        }
        editor_lines_array_append(&E->lines, empty_line);
        editor_update_syntax(0);
        editor_set_status_message(
            "ErwinText: Press Ctrl+Q to quit. Ctrl+S to save. Ctrl+F to find.");
    }

    editor_refresh_screen();

    while (1)
    {
        editor_process_keypress();
    }

    return 0;
}
```

Here is a detail most tutorials skip: an empty file is not an empty buffer.
We always seed the buffer with one empty line. That way the renderer always
has a line to draw and the cursor always has somewhere to be. If you have
ever opened a "new file" in a naive editor and seen nothing render until
you type a character, this is the fix.

## Moving the Cursor

Cursor movement is one of those things that looks trivial and hides a
surprising amount of policy. We want arrow keys that wrap at line edges
(Left at column 0 of a non-first line jumps to the end of the line above;
Right at end-of-line jumps to the start of the next line), Home/End,
PageUp/PageDown that move by a screenful, and — important — we must never
leave the cursor past the end of the current line or below the last line.

```c
void editor_move_cursor(int key)
{
    EditorLine* line = (E.cy >= E.lines.size) ? NULL : &E.lines.elements[E.cy];

    if (E.select_active)
    {
        switch (key)
        {
        case KEY_SRIGHT:
            key = KEY_RIGHT;
            break;
        case KEY_SLEFT:
            key = KEY_LEFT;
            break;
        case KEY_SR:
            key = KEY_UP;
            break;
        case KEY_SF:
            key = KEY_DOWN;
            break;
        case KEY_SHOME:
            key = KEY_HOME;
            break;
        case KEY_SEND:
            key = KEY_END;
            break;
        case KEY_SPREVIOUS:
            key = KEY_PPAGE;
            break;
        case KEY_SNEXT:
            key = KEY_NPAGE;
            break;
        }
    }
    else
    {
        editor_clear_selection();
    }

    switch (key)
    {

    case KEY_LEFT:
        if (E.cx > 0)
        {
            E.cx--;
        }
        else if (E.cy > 0)
        {
            E.cy--;
            E.cx = E.lines.elements[E.cy].len;
        }
        break;
    case KEY_RIGHT:
        if (line && (size_t) E.cx < line->len)
        {
            E.cx++;
        }
        else if (line && (size_t) E.cx == line->len && E.cy < E.lines.size - 1)
        {
            if (line && (size_t) E.cx == line->len && E.cy < E.lines.size - 1)
            {
                E.cy++;
                E.cx = 0;
            }
        }
        break;
    case KEY_UP:
        if (E.cy > 0)
        {
            E.cy--;
        }
        break;
    case KEY_DOWN:
        if (E.cy < E.lines.size - 1)
        {
            E.cy++;
        }
        break;
    case KEY_HOME:
        E.cx = 0;
        break;
    case KEY_END:
        if (line)
            E.cx = line->len;
        break;
    case KEY_PPAGE:
    case KEY_NPAGE:
    {
        int times = E.screen_rows;
        while (times--)
        {
            if (key == KEY_PPAGE)
            {
                if (E.cy > 0)
                    E.cy--;
            }
            else
            {
                if (E.cy < E.lines.size - 1)
                    E.cy++;
            }
        }
    }
    break;
    }
    line = (E.cy >= E.lines.size) ? NULL : &E.lines.elements[E.cy];
    int line_len = line ? line->len : 0;
    if (E.cx > line_len)
    {
        E.cx = line_len;
    }
}
```

Two things are worth calling out. First, all the Shift+Arrow combinations
(`KEY_SRIGHT` etc.) are translated to their plain equivalents *after*
deriving the selection anchor — so the selection grows as the cursor
moves, and any non-shift key clears it. Second, the final clamp handles
lines of different lengths: if you move Up from a long line onto a shorter
one, the cursor is pulled back to the end of the shorter line.

## Inserting Text

Inserting a character is the operation that best shows the memory
discipline of C. The line is a heap string. We reallocate to make room for
one more byte, shift the tail right by one, drop the character in, and
bump the length. Preallocate? We just take the realloc cost per
keystroke. For a text editor, that is fine — keystrokes are slow, and the
allocator is fast.

```c
void editor_insert_char(int c)
{
    EditorAction action = {
        .type = ACTION_INSERT_CHAR, .row = E.cy, .col = E.cx, .character = (char) c};
    editor_record_action(action);
    if (E.cy == E.lines.size)
    {
        EditorLine new_line = {.text = strdup(""), .len = 0, .hl = NULL, .hl_open_comment = 0};
        if (new_line.text == NULL)
        {
            editor_handle_error(ERR_OUT_OF_MEMORY,
                                "Failed to prepare new line for character insertion.");
            return;
        }
        editor_lines_array_append(&E.lines, new_line);
    }

    EditorLine* line = &E.lines.elements[E.cy];
    line->text = realloc(line->text, line->len + 2);
    if (line->text == NULL)
    {
        editor_handle_error(ERR_OUT_OF_MEMORY, "Out of memory for line %d.", E.cy);
        return;
    }
    memmove(&line->text[E.cx + 1], &line->text[E.cx], line->len - E.cx + 1);
    line->text[E.cx] = c;
    line->len++;
    E.cx++;
    E.dirty = 1;

    editor_update_syntax(E.cy);
}
```

Note the `realloc(..., line->len + 2)`: one byte for the new character,
one for the NUL terminator. Off-by-one errors at the end of strings are the
classic C bug, and `memmove`'s `+ 1` is moving the NUL too. If you take one
thing away from this post, let it be: always count the terminator.

Newline insertion is the same idea, but splits one line into two. The
whole second half of the current line becomes a new line:

```c
int editor_insert_newline(void)
{
    EditorAction action = {.type = ACTION_INSERT_NEWLINE, .row = E.cy, .col = E.cx};
    editor_record_action(action);
    if (E.lines.size == 0)
    {
        EditorLine new_line = {.text = strdup(""), .len = 0, .hl = NULL, .hl_open_comment = 0};
        if (new_line.text == NULL)
        {
            editor_handle_error(ERR_OUT_OF_MEMORY, "Out of memory for initial line text.");
            return -1;
        }
        editor_lines_array_append(&E.lines, new_line);
        E.cy = 0;
        E.cx = 0;
        E.dirty = 1;
        editor_update_syntax(0);
        return 0;
    }

    EditorLine new_line = {.text = NULL, .len = 0, .hl = NULL, .hl_open_comment = 0};
    editor_lines_array_insert(&E.lines, E.cy + 1, new_line);

    E.lines.elements[E.cy].hl = NULL;
    E.lines.elements[E.cy].hl_open_comment = 0;

    if (E.cx == 0)
    {
        E.lines.elements[E.cy].text = strdup("");
        if (E.lines.elements[E.cy].text == NULL)
        {
            editor_handle_error(ERR_OUT_OF_MEMORY, "Out of memory for new empty line text.");
            return -1;
        }
        E.lines.elements[E.cy].len = 0;
    }
    else
    {
        EditorLine* current_line = &E.lines.elements[E.cy];
        E.lines.elements[E.cy + 1].len = current_line->len - E.cx;
        E.lines.elements[E.cy + 1].text = strdup(&current_line->text[E.cx]);
        if (E.lines.elements[E.cy + 1].text == NULL)
        {
            editor_handle_error(ERR_OUT_OF_MEMORY, "Out of memory for split line text.");
            return -1;
        }
        E.lines.elements[E.cy + 1].hl = NULL;
        E.lines.elements[E.cy + 1].hl_open_comment = 0;

        current_line->text = realloc(current_line->text, E.cx + 1);
        if (current_line->text == NULL)
        {
            editor_handle_error(ERR_OUT_OF_MEMORY, "Out of memory for truncated line.");
            return -1;
        }
        current_line->text[E.cx] = '\0';
        current_line->len = E.cx;
    }

    E.cy++;
    E.cx = 0;
    E.dirty = 1;

    editor_update_syntax(E.cy - 1);
    editor_update_syntax(E.cy);

    return 0;
}
```

When Enter is pressed at column 0, we just insert an empty line before the
cursor. Otherwise we duplicate the tail (`strdup(&current_line->text[E.cx])`),
truncate the original at the cursor, and advance. The syntax highlights of
the split lines are recomputed because a line break can change comment and
string state.

## Deleting Text

Backspace does two different things depending on where the cursor is. If
there is a character to the left, delete it. If the cursor is at column 0
of a line (other than the first), join the current line onto the end of the
line above. This is the "line merge" path, and it is the fiddliest edit
operation in the whole editor, because it has to handle the case where the
buffer ends up empty.

```c
void editor_del_char(void)
{
    EditorAction action = {.type = ACTION_DELETE_CHAR, .row = E.cy, .col = E.cx};
    if (E.cx > 0)
    {
        action.character = E.lines.elements[E.cy].text[E.cx - 1];
    }
    else
    {
        action.type = ACTION_DELETE_LINE;
        if (E.recording_actions)
        {
            // editor_record_action() drops the action without freeing it when
            // recording is off, so only allocate when it will actually be kept.
            action.line_content = strdup(E.lines.elements[E.cy].text);
            action.line_len = E.lines.elements[E.cy].len;
        }
    }
    editor_record_action(action);
    if (E.select_all_active)
    {
        free_editor_lines_array(&E.lines);
        init_editor_lines_array(&E.lines);
        EditorLine new_line = {.text = strdup(""), .len = 0, .hl = NULL, .hl_open_comment = 0};
        if (new_line.text == NULL)
        {
            editor_handle_error(ERR_OUT_OF_MEMORY, "Out of memory (clear all text).");
        }
        editor_lines_array_append(&E.lines, new_line);
        E.cx = 0;
        E.cy = 0;
        E.dirty = 1;
        E.select_all_active = 0;
        editor_update_syntax(0);
        editor_set_status_message("All text deleted.");
        return;
    }

    if (E.cy == E.lines.size || E.lines.size == 0)
        return;
    if (E.cx == 0 && E.cy == 0 && E.lines.elements[0].len == 0)
        return;

    EditorLine* line = &E.lines.elements[E.cy];
    if (E.cx > 0)
    {
        memmove(&line->text[E.cx - 1], &line->text[E.cx], line->len - E.cx + 1);
        line->len--;
        line->text = realloc(line->text, line->len + 1);
        if (line->text == NULL)
        {
            editor_handle_error(ERR_OUT_OF_MEMORY, "Out of memory (del char realloc).");
            return;
        }
        E.cx--;
        E.dirty = 1;
        editor_update_syntax(E.cy);
    }
    else
    {
        if (E.cy > 0)
        {
            EditorLine* prev_line = &E.lines.elements[E.cy - 1];
            prev_line->text = realloc(prev_line->text, prev_line->len + line->len + 1);
            if (prev_line->text == NULL)
            {
                editor_handle_error(ERR_OUT_OF_MEMORY, "Out of memory (merge line realloc).");
                return;
            }
            memcpy(&prev_line->text[prev_line->len], line->text, line->len);
            int ecx_prevline = prev_line->len;
            prev_line->len += line->len;
            prev_line->text[prev_line->len] = '\0';

            editor_lines_array_delete(&E.lines, E.cy);

            if (E.lines.size == 0)
            {
                EditorLine new_line = {
                    .text = strdup(""), .len = 0, .hl = NULL, .hl_open_comment = 0};
                if (new_line.text == NULL)
                {
                    editor_handle_error(ERR_OUT_OF_MEMORY, "Out of memory (empty file text).");
                }
                editor_lines_array_append(&E.lines, new_line);
                E.cx = 0;
                E.cy = 0;
                editor_update_syntax(0);
            }
            else
            {
                E.cx = ecx_prevline;
                E.cy--;
                editor_update_syntax(E.cy);
            }
            E.dirty = 1;
        }
    }
}
```

There is more here than meets the eye. First, we record the action *before*
doing the work, so the undo log captures the original state. Second, when
deleting across the line boundary (backspace at column 0), we store the
whole deleted line content in the action — that is what lets undo restore
it exactly. Third, note the `memmove` copies `line->len - E.cx + 1` bytes:
the tail *plus* the NUL terminator. And fourth, when the merge empties the
buffer, we immediately re-seed a single empty line, because the editor
invariant is "never zero lines."

There is also a recording guard at the top (`if (E.recording_actions)`).
This is how the selection-delete path avoids flooding the undo log with
one entry per character: it suspends recording, runs the deletion, then
resumes. We will see the full picture in the undo section.

## Rendering the Screen

ncurses gives us the low-level "put a character at a position" primitive.
The renderer's job is to turn the buffer into a screen. For each row we
display, we find the corresponding file row, then walk the line's
characters, skipping the horizontal scroll offset and stopping at the
right edge.

```c
void editor_draw_rows(void)
{
    EditorConfig* E = get_editor_config();
    int y;
    for (y = 0; y < E->screen_rows; y++)
    {
        int filerow = y + E->row_offset;

        if (filerow >= E->lines.size)
        {
        }
        else
        {
            EditorLine* line = &E->lines.elements[filerow];
            int current_color_pair = HL_NORMAL;
            int display_col = 0;

            for (size_t i = 0; i < line->len; i++)
            {
                int char_display_width = 1;
                if (line->text[i] == '\t')
                {
                    char_display_width = TAB_STOP - (display_col % TAB_STOP);
                }

                if (display_col < E->col_offset)
                {
                    display_col += char_display_width;
                    continue;
                }

                if ((display_col - E->col_offset) >= E->screen_cols)
                    break;

                if (E_syntax && has_colors())
                {
                    int hl_type = line->hl[i];
                    if (hl_type != current_color_pair)
                    {
                        attroff(COLOR_PAIR(current_color_pair));
                        current_color_pair = hl_type;
                        attron(COLOR_PAIR(current_color_pair));
                    }
                }

                if (line->text[i] == '\t')
                {
                    for (int k = 0; k < char_display_width; k++)
                    {
                        mvaddch(y, (display_col - E->col_offset) + k, ' ');
                    }
                }
                else
                {
                    mvaddch(y, (display_col - E->col_offset), line->text[i]);
                }
                display_col += char_display_width;
            }
            if (E_syntax && has_colors())
            {
                attroff(COLOR_PAIR(current_color_pair));
            }
        }
        clrtoeol();
    }
}
```

Tabs are special: a tab does not occupy one cell, it jumps to the next
tab stop (we use `TAB_STOP 4` from `ui_constants.h`). The code computes
`char_display_width` so the cursor math stays honest even with tabs on
screen. `clrtoeol()` cleans up the rest of the line so short lines do not
leave stale characters behind.

The status bar is one reverse-video line at the bottom, showing the
filename, line count, dirty marker, and the current line position:

```c
void editor_draw_status_bar(void)
{
    EditorConfig* E = get_editor_config();
    attron(A_REVERSE);

    mvprintw(E->screen_rows, 0, "%.20s - %d lines %s", E->filename ? E->filename : "[No Name]",
             E->lines.size, E->dirty ? "(modified)" : "");

    char rstatus[80];
    snprintf(rstatus, sizeof(rstatus), "%d/%d", E->cy + 1, E->lines.size);
    mvprintw(E->screen_rows, E->screen_cols - strlen(rstatus), "%s", rstatus);

    attroff(A_REVERSE);
}
```

The message bar sits on the next row and is where transient messages go —
"Saved", "No more matches", and so on. It is also where an error message
lives when something goes wrong. We will come back to that.

## Scrolling

Scrolling is where a lot of editors get janky. The trick is to treat it
as a problem of offsets: when the cursor goes above the top of the
viewport, bring the viewport up; below the bottom, move it down; beyond
the right edge, scroll right; past the left edge, scroll left. The renderer
already knows how to skip `row_offset` and `col_offset`; scrolling just
adjusts those numbers before the next frame.

```c
void editor_scroll(void)
{
    EditorConfig* E = get_editor_config();
    if (E->cy < E->row_offset)
    {
        E->row_offset = E->cy;
    }
    if (E->cy >= E->row_offset + E->screen_rows)
    {
        E->row_offset = E->cy - E->screen_rows + 1;
    }
    if (E->cx < E->col_offset)
    {
        E->col_offset = E->cx;
    }
    if (E->cx >= E->col_offset + E->screen_cols)
    {
        E->col_offset = E->cx - E->screen_cols + 1;
    }
}
```

`editor_refresh_screen` calls `editor_scroll`, then redraws everything:

```c
void editor_refresh_screen(void)
{
    EditorConfig* E = get_editor_config();
    editor_scroll();
    editor_draw_rows();
    editor_draw_status_bar();
    editor_draw_message_bar();
    move(E->cy - E->row_offset, get_cx_display());
    refresh();
}
```

## Opening and Saving Files

File I/O uses `getline` — the POSIX function that grows its own buffer, so
we never have to guess a max line length. We strip the trailing newline
and carriage return, then append each line to the line array.

```c
void editor_read_file(const char* filename)
{
    EditorConfig* E = get_editor_config();
    if (E->filename)
        free(E->filename);
    E->filename = strdup(filename);
    if (E->filename == NULL)
    {
        editor_handle_error(ERR_OUT_OF_MEMORY, "Out of memory (filename).");
    }

    editor_select_syntax_highlight();

    FILE* fp = fopen(filename, "r");
    if (!fp)
    {
        if (errno == ENOENT)
        {
            init_editor_lines_array(&E->lines);
            EditorLine new_line = {.text = strdup(""), .len = 0, .hl = NULL, .hl_open_comment = 0};
            if (new_line.text == NULL)
            {
                editor_handle_error(ERR_OUT_OF_MEMORY, "Out of memory (initial line text).");
            }
            editor_lines_array_append(&E->lines, new_line);
            editor_set_status_message("New file: %s", filename);
        }
        else
        {
            editor_handle_error(ERR_FILE_OPERATION, "Error opening file '%s': %s", filename,
                                strerror(errno));
        }
        return;
    }

    char* line_buffer = NULL;
    size_t linecap = 0;
    ssize_t linelen;

    while ((linelen = getline(&line_buffer, &linecap, fp)) != -1)
    {
        while (linelen > 0 &&
               (line_buffer[linelen - 1] == '\n' || line_buffer[linelen - 1] == '\r'))
        {
            linelen--;
        }

        EditorLine new_line = {
            .text = malloc(linelen + 1), .len = linelen, .hl = NULL, .hl_open_comment = 0};
        if (new_line.text == NULL)
        {
            free(line_buffer);
            editor_handle_error(ERR_OUT_OF_MEMORY, "Out of memory (line text).");
        }
        memcpy(new_line.text, line_buffer, linelen);
        new_line.text[linelen] = '\0';
        editor_lines_array_append(&E->lines, new_line);
    }
    free(line_buffer);
    fclose(fp);

    for (int i = 0; i < E->lines.size; i++)
    {
        editor_update_syntax(i);
    }

    E->dirty = 0;
    editor_set_status_message("Opened file: %s (%d lines)", filename, E->lines.size);
}
```

Two design choices here are worth stealing. First, a missing file is not an
error — it is a brand-new file. That is why the editor lets you run
`erwintext notes.txt` and start typing even though `notes.txt` does not
exist yet. Second, the syntax highlighter is chosen based on the filename
extension before we read a single line, because the highlight pass needs to
know the language to color the content as it loads.

Saving is the inverse: write every line followed by a newline.

```c
void editor_save_file(void)
{
    EditorConfig* E = get_editor_config();
    if (!E->filename)
    {
        char* new_filename = editor_prompt("Save as: %s (ESC to cancel)", "");
        if (new_filename == NULL)
        {
            editor_set_status_message("Save cancelled.");
            return;
        }
        if (E->filename)
            free(E->filename);
        E->filename = new_filename;
        editor_select_syntax_highlight();
    }

    FILE* fp = fopen(E->filename, "w");
    if (!fp)
    {
        editor_set_status_message("Error saving file: %s", strerror(errno));
        return;
    }

    for (int i = 0; i < E->lines.size; ++i)
    {
        fprintf(fp, "%s\n", E->lines.elements[i].text);
    }
    fclose(fp);
    E->dirty = 0;
    editor_set_status_message("File saved: %s", E->filename);
}
```

Yes, this is the naive O(n) line-by-line write, and it does not write a
temp file and rename it (no atomic save). It is a good place to start; we
will note the upgrade path in the later section on limitations.

## Find

Incremental find needs its own state: the query, the direction, and the
last match position so "next" can continue from where the previous search
stopped. We keep that in the main editor struct:

```c
char* search_query;
int search_direction; // 1 for forward, -1 for backward
int last_match_row;
int last_match_col;
bool find_active;
```

The search itself is a manual forward/backward scan over the lines. Because
we want "N" to keep finding matches and to wrap around, we track the start
position and detect when we have come full circle. Highlights for matches
are applied in `editor_update_syntax`, which is where the highlighter
hooks into the search state (later).

There is a subtlety in the UI: while `find_active` is true, pressing
arrow keys navigates matches instead of moving the cursor. The keypress
handler checks `E.find_active` before the normal dispatch, so Up/Down
become "previous match / next match" — a small but very useful touch.

```c
void editor_find(void)
{
    char* query = editor_prompt("Search (Use arrows to navigate, ESC to cancel): %s",
                                E.search_query ? E.search_query : "");

    if (query == NULL)
    {
        editor_set_status_message("");
        E.find_active = false;
        for (int i = 0; i < E.lines.size; i++)
        {
            editor_update_syntax(i);
        }
        editor_refresh_screen();
        return;
    }

    if (E.search_query)
    {
        if (strcmp(E.search_query, query) != 0)
        {
            free(E.search_query);
            E.search_query = query;
            E.last_match_row = -1;
            E.last_match_col = -1;
        }
        else
        {
            free(query);
        }
    }
    else
    {
        E.search_query = query;
        E.last_match_row = -1;
        E.last_match_col = -1;
    }

    E.find_active = true;
    editor_find_next(1);
}
```

The forward case is easy: `strstr` from the current column. The backward
case is the fiddly one — we search the line from the end toward the start
using `strncmp` at each candidate offset. Here is the full scan:

```c
void editor_find_next(int direction)
{
    if (E.search_query == NULL)
        return;

    int current_row = E.last_match_row;
    int current_col = E.last_match_col;

    if (current_row == -1)
    {
        current_row = E.cy;
        current_col = E.cx;
        E.search_direction = direction;
    }
    else
    {
        current_col += direction;
    }

    int query_len = strlen(E.search_query);
    int original_row = current_row;
    int original_col = current_col;

    while (1)
    {
        if (current_row < 0 || current_row >= E.lines.size)
            break;

        EditorLine* line = &E.lines.elements[current_row];
        char* match = NULL;

        if (direction == 1)
        {
            if ((size_t) current_col >= line->len)
            {
                current_row++;
                current_col = 0;
                continue;
            }
            match = strstr(line->text + current_col, E.search_query);
        }
        else
        {
            if (current_col < 0)
            {
                current_row--;
                if (current_row < 0)
                    break;
                current_col = E.lines.elements[current_row].len - 1;
                for (int i = current_col; i >= 0; i--)
                {
                    if ((size_t) i + query_len <= line->len &&
                        strncmp(line->text + i, E.search_query, query_len) == 0)
                    {
                        match = line->text + i;
                        break;
                    }
                }
            }
        }

        if (match)
        {
            E.cy = current_row;
            E.cx = match - line->text;
            E.last_match_row = E.cy;
            E.last_match_col = E.cx;
            editor_set_status_message("Found '%s' at %d:%d", E.search_query, E.cy + 1, E.cx + 1);
            editor_refresh_screen();
            return;
        }

        if (direction == 1)
        {
            current_row++;
            current_col = 0;
        }
        else
        {
            current_row--;
            current_col = E.lines.elements[current_row].len - 1;
        }

        if (current_row >= E.lines.size)
        {
            current_row = 0;
            current_col = 0;
        }
        else if (current_row < 0)
        {
            current_row = E.lines.size - 1;
            current_col = E.lines.elements[current_row].len - 1;
        }

        if (current_row == original_row && current_col == original_col)
        {
            break;
        }
    }
    editor_set_status_message("No more matches for '%s'", E.search_query);
    E.last_match_row = -1;
    E.last_match_col = -1;
    editor_refresh_screen();
}
```

## Syntax Highlighting

Syntax highlighting is where an editor starts to feel like a real program.
Our highlighter is deliberately simple: it is a table-driven, per-line
scanner, not a full lexer. A line is scanned left to right, and each
character gets a highlight code assigned. The state that survives across
lines (multiline comments) is stored in the line's `hl_open_comment` flag.

The table defines what to look for:

```c
enum EditorHighlight
{
    HL_NORMAL = 0,
    HL_COMMENT,
    HL_KEYWORD1,
    HL_KEYWORD2,
    HL_STRING,
    HL_NUMBER,
    HL_MATCH,
    HL_PREPROC
};
```

```c
EditorSyntax* EditorSyntaxes[] = {&C_syntax,   &SH_syntax,  &JS_syntax, &HTML_syntax,
                                  &CSS_syntax, &XML_syntax, NULL};

void editor_select_syntax_highlight(void)
{
    EditorConfig* E = get_editor_config();
    E_syntax = NULL;

    if (E->filename)
    {
        char* ext = strrchr(E->filename, '.');

        if (ext)
        {
            for (int i = 0; EditorSyntaxes[i]; i++)
            {
                EditorSyntax* syntax = EditorSyntaxes[i];
                for (int j = 0; syntax->filetype_extensions[j]; j++)
                {
                    if (strcmp(ext, syntax->filetype_extensions[j]) == 0)
                    {
                        E_syntax = syntax;
                        return;
                    }
                }
            }
        }
    }
}
```

Each language definition is just data. Here is C's:

```c
char* C_HL_extensions[] = {".c", ".h", ".cpp", ".hpp", ".cc", NULL};
char* C_HL_keywords[] = {"switch", "if",       "while",      "for",      "break",    "continue",
                         "return", "else",     "goto",       "auto",     "register", "extern",
                         "const",  "unsigned", "signed",     "volatile", "do",       "typeof",
                         "_Bool",  "_Complex", "_Imaginary", "case",     "default",  "sizeof",
                         "enum",   "union",    "struct",     "typedef",  NULL};
char* C_HL_types[] = {"int", "char", "float", "double", "void", "long", "short", NULL};
EditorSyntax C_syntax = {
    C_HL_extensions, C_HL_keywords, C_HL_types, "//", "/*", "*/",
};
```

The per-line scanner is where it all comes together. For each character we
check, in order: multiline comment state, single-line comment, strings
(with escape handling), numbers, preprocessor directives, then keyword
lists. A `prev_sep` flag tracks whether the previous character was a
separator, so we do not highlight the "if" inside "lifespan" as a keyword.

```c
void editor_update_syntax(int filerow)
{
    EditorConfig* E = get_editor_config();
    EditorLine* line = &E->lines.elements[filerow];

    if (line->hl)
        free(line->hl);
    line->hl = malloc(line->len);
    if (line->hl == NULL)
    {
        return;
    }
    memset(line->hl, HL_NORMAL, line->len);

    if (E_syntax == NULL)
        return;

    char** keywords1 = E_syntax->keywords1;
    char** keywords2 = E_syntax->keywords2;
    char* sc_start = E_syntax->singleline_comment_start;
    char* mc_start = E_syntax->multiline_comment_start;
    char* mc_end = E_syntax->multiline_comment_end;

    int prev_sep = 1;
    int in_string = 0;
    int in_multiline_comment = (filerow > 0 && E->lines.elements[filerow - 1].hl_open_comment);

    int i = 0;
    while ((size_t) i < line->len)
    {
        char c = line->text[i];
        unsigned char prev_hl = (i > 0) ? line->hl[i - 1] : HL_NORMAL;

        if (mc_start && mc_end)
        {
            if (in_multiline_comment)
            {
                line->hl[i] = HL_COMMENT;
                if (strncmp(&line->text[i], mc_end, strlen(mc_end)) == 0)
                {
                    for (size_t j = 0; j < strlen(mc_end); j++)
                        line->hl[i + j] = HL_COMMENT;
                    i += strlen(mc_end);
                    in_multiline_comment = 0;
                    prev_sep = 1;
                    continue;
                }
                i++;
                continue;
            }
            else if (strncmp(&line->text[i], mc_start, strlen(mc_start)) == 0)
            {
                if (strncmp(&line->text[i], mc_start, strlen(mc_start)) == 0)
                {
                    for (size_t j = 0; j < strlen(mc_start); j++)
                        line->hl[i + j] = HL_COMMENT;
                    i += strlen(mc_start);
                    in_multiline_comment = 1;
                    continue;
                }
            }
        }

        if (sc_start && strncmp(&line->text[i], sc_start, strlen(sc_start)) == 0)
        {
            for (size_t j = i; j < line->len; j++)
            {
                line->hl[j] = HL_COMMENT;
            }
            break;
        }

        if (in_string)
        {
            line->hl[i] = HL_STRING;
            if (c == '\\' && (size_t i + 1) < line->len)
            {
                line->hl[i + 1] = HL_STRING;
                i += 2;
                continue;
            }
            if (c == in_string)
            {
                in_string = 0;
            }
            i++;
            prev_sep = 0;
            continue;
        }
        else
        {
            if (c == '"' || c == '\'')
            {
                in_string = c;
                line->hl[i] = HL_STRING;
                i++;
                prev_sep = 0;
                continue;
            }
        }

        if (isdigit(c) && (prev_sep || prev_hl == HL_NUMBER))
        {
            line->hl[i] = HL_NUMBER;
            i++;
            prev_sep = 0;
            continue;
        }

        if (i == 0 && c == '#')
        {
            for (size_t j = 0; j < line->len; j++)
            {
                line->hl[j] = HL_PREPROC;
            }
            break;
        }

        if (prev_sep)
        {
            for (size_t k = 0; keywords1[k]; k++)
            {
                size_t kwlen = strlen(keywords1[k]);
                if (strncmp(&line->text[i], keywords1[k], kwlen) == 0 &&
                    is_separator(line->text[i + kwlen]))
                {
                    for (size_t j = 0; j < kwlen; j++)
                        line->hl[i + j] = HL_KEYWORD1;
                    i += kwlen;
                    prev_sep = 0;
                    goto next_char_in_loop;
                }
            }
            for (size_t k = 0; keywords2[k]; k++)
            {
                size_t kwlen = strlen(keywords2[k]);
                if (strncmp(&line->text[i], keywords2[k], kwlen) == 0 &&
                    is_separator(line->text[i + kwlen]))
                {
                    for (size_t j = 0; j < kwlen; j++)
                        line->hl[i + j] = HL_KEYWORD2;
                    i += kwlen;
                    prev_sep = 0;
                    goto next_char_in_loop;
                }
            }
        }

        prev_sep = is_separator(c);
        i++;
    next_char_in_loop:;
    }

    if (E->find_active && E->search_query && filerow >= E->row_offset &&
        filerow < E->row_offset + E->screen_rows)
    {
        char* match_ptr = line->text;
        while ((match_ptr = strstr(match_ptr, E->search_query)) != NULL)
        {
            int start_col = match_ptr - line->text;
            for (size_t k = 0; k < strlen(E->search_query); k++)
            {
                if ((size_t) start_col + k < line->len)
                {
                    line->hl[start_col + k] = HL_MATCH;
                }
            }
            match_ptr += strlen(E->search_query);
        }
    }

    int changed_comment_state = (line->hl_open_comment != in_multiline_comment);
    line->hl_open_comment = in_multiline_comment;

    if (changed_comment_state && filerow + 1 < E->lines.size)
    {
        editor_update_syntax(filerow + 1);
    }
}

int is_separator(int c)
{
    return isspace(c) || c == '\0' || strchr(",.()+-/*=~%<>[];", c) != NULL;
}
```

There is a deliberate cheat in the scanner: when a keyword is matched, we
only check the first separator after it, and the multiline comment closing
is found with a raw `strncmp` rather than a real tokenizer. It is a
scanner, not a parser, and it is honest about it. The `goto next_char_in_loop`
is the one place the codebase uses a `goto`, and it is there for a good
reason: it lets the keyword matcher skip the separator bookkeeping that
would otherwise complicate the loop. Some compilers will warn about
fallthrough here; the code uses a labeled loop tail to keep it clean.

Notice the tail of the function: when the line's multiline-comment state
changes, we eagerly re-highlight the *next* line too, because the state
flows downward. That propagation is what makes `/* ... */` spans work
across multiple lines without a full-file rescan.

## Selection

Selection starts with the Shift+Arrow keys, a feature contributed by
[Paulo Ferlin](https://github.com/paulorf0) (PR #26). ncurses reports these
distinctly (KEY_SLEFT, KEY_SRIGHT, KEY_SF, KEY_SR for Shift+arrows, plus
Shift+Home/End/PageUp/PageDown), and we detect them in the cursor handler,
where we translate them to the plain movement while *keeping* `select_active`.
The selection is defined by an anchor (where Shift was first pressed) and
the cursor's current position, which is exactly how most editors model it.
Paulo also extended Shift selection to Home/End/PageUp/PageDown in PR #30,
and made the whole thing more forgiving: those keys only extend or clear the
selection when Shift is held, so plain navigation never surprises you.

```c
EditorSelectionRange editor_resolve_selection(void)
{
    EditorSelectionRange range;

    if (E.sel_start_row < E.cy || (E.sel_start_row == E.cy && E.sel_start_col <= E.cx))
    {
        range.start_row = E.sel_start_row;
        range.start_col = E.sel_start_col;
        range.end_row = E.cy;
        range.end_col = E.cx;
    }
    else
    {
        range.start_row = E.cy;
        range.start_col = E.cx;
        range.end_row = E.sel_start_row;
        range.end_col = E.sel_start_col;
    }

    return range;
}
```

The range type is just four integers:

```c
typedef struct
{
    int start_row;
    int start_col;
    int end_row;
    int end_col;
} EditorSelectionRange;
```

The "what is selected" lookup handles both normal selection and the
"Select All" mode (Ctrl+A), which selects the whole buffer as one range:

```c
int editor_get_selection_range(EditorSelectionRange* out)
{
    if (E.select_all_active)
    {
        out->start_row = 0;
        out->start_col = 0;
        out->end_row = E.lines.size > 0 ? E.lines.size - 1 : 0;
        out->end_col = E.lines.size > 0 ? E.lines.elements[out->end_row].len : 0;
        return 1;
    }
    if (E.select_active)
    {
        *out = editor_resolve_selection();
        return 1;
    }
    return 0;
}
```

Copying the selected text walks the rows, picks the right slice of each
line, and joins them with `\n`:

```c
char* editor_get_selected_text(EditorSelectionRange range)
{
    size_t total_len = 0;

    for (int row = range.start_row; row <= range.end_row; row++)
    {
        EditorLine* line = &E.lines.elements[row];
        size_t from = (row == range.start_row) ? (size_t) range.start_col : 0;
        size_t to = (row == range.end_row) ? (size_t) range.end_col : line->len;
        total_len += to - from;
        if (row != range.end_row)
        {
            total_len += 1; // '\n'
        }
    }

    char* text = malloc(total_len + 1);
    if (text == NULL)
    {
        editor_handle_error(ERR_OUT_OF_MEMORY, "Out of memory building selected text.");
        return NULL;
    }

    size_t pos = 0;
    for (int row = range.start_row; row <= range.end_row; row++)
    {
        EditorLine* line = &E.lines.elements[row];
        size_t from = (row == range.start_row) ? (size_t) range.start_col : 0;
        size_t to = (row == range.end_row) ? (size_t) range.end_col : line->len;
        size_t chunk_len = to - from;

        memcpy(&text[pos], &line->text[from], chunk_len);
        pos += chunk_len;

        if (row != range.end_row)
        {
            text[pos++] = '\n';
        }
    }
    text[pos] = '\0';

    return text;
}
```

## Clipboard: Talking to the System

Here is where we earn our C keep. The editor does not have its own clipboard
— it uses whatever the desktop provides. On Wayland that is `wl-copy` /
`wl-paste`; on X11, `xclip`. To copy, we fork a child process that runs
the clipboard tool, pipe the selected text to its stdin, and wait. It is
textbook `pipe()` + `fork()` + `execvp()` + `dup2()`, and once you have
written it once, every subprocess-in-C you ever write gets easier.
This system-clipboard integration was contributed by
[Paulo Ferlin](https://github.com/paulorf0) (PR #30).

We detect which tool is available at startup:

```c
typedef enum
{
    CLIPBOARD_NONE,
    CLIPBOARD_WAYLAND,
    CLIPBOARD_X11
} ClipboardTool;

static ClipboardTool editor_detect_clipboard_tool(void)
{
    if (system("command -v wl-copy >/dev/null 2>&1") == 0)
    {
        return CLIPBOARD_WAYLAND;
    }
    if (system("command -v xclip >/dev/null 2>&1") == 0)
    {
        return CLIPBOARD_X11;
    }
    return CLIPBOARD_NONE;
}
```

Copy uses the pipe in one direction (text flows into the child):

```c
static void editor_send_to_clipboard(const char* text, size_t len)
{
    int pipefd[2];
    pid_t pid;
    char* clipboard_tool = NULL;
    char* argv[4];

    switch (E.clipboard_tool)
    {
    case CLIPBOARD_WAYLAND:
        clipboard_tool = "wl-copy";
        argv[0] = "wl-copy";
        argv[1] = NULL;
        break;
    case CLIPBOARD_X11:
        clipboard_tool = "xclip";
        argv[0] = "xclip";
        argv[1] = "-selection";
        argv[2] = "clipboard";
        argv[3] = NULL;
        break;
    case CLIPBOARD_NONE:
    default:
        editor_handle_error(ERR_CLIPBOARD_TOOL,
                            "Copy error: Neither wl-copy nor xclip found. Please install one.");
        return;
    }

    editor_set_status_message("Attempting to copy using %s...", clipboard_tool);
    editor_refresh_screen();

    fflush(stdout);

    if (pipe(pipefd) == -1)
    {
        editor_handle_error(ERR_CLIPBOARD_TOOL, "Copy error: Failed to create pipe.");
        return;
    }

    pid = fork();
    if (pid == -1)
    {
        editor_handle_error(ERR_CLIPBOARD_TOOL, "Copy error: Failed to fork process.");
        close(pipefd[0]);
        close(pipefd[1]);
        return;
    }

    if (pid == 0)
    {
        close(pipefd[1]);
        dup2(pipefd[0], STDIN_FILENO);
        close(pipefd[0]);

        execvp(clipboard_tool, argv);

        _exit(1);
    }
    else
    {
        close(pipefd[0]);

        size_t written = 0;
        while (written < len)
        {
            ssize_t bytes_written = write(pipefd[1], text + written, len - written);
            if (bytes_written <= 0)
            {
                break;
            }
            written += (size_t) bytes_written;
        }
        close(pipefd[1]);

        int status;
        waitpid(pid, &status, 0);

        if (WIFEXITED(status) && WEXITSTATUS(status) == 0)
        {
            editor_set_status_message("Copied to clipboard using %s.", clipboard_tool);
        }
        else
        {
            editor_set_status_message("Copy error: %s failed or returned an error.",
                                      clipboard_tool);
        }
    }
}
```

Walk through it: the child closes the write end, redirects its stdin to
the read end, and execs the tool. The parent closes the read end, writes
the whole text into the pipe, closes the write end (so the child sees
EOF), then waits for the child and reports success or failure. The
`_exit(1)` after exec failure is a C idiom worth remembering: `_exit` skips
atexit handlers, which matters when you have ncurses state that must not be
cleaned up from a forked child.

Paste is the mirror image: the child's stdout becomes the read end of the pipe,
and the parent reads the tool's output and replays it into the editor as a
stream of insert operations.

```c
void paste_from_clipboard(void)
{
    int pipefd[2];
    pid_t pid;
    char buffer[1024];
    ssize_t bytes_read;
    char* clipboard_tool = NULL;
    char* argv[3];

    switch (E.clipboard_tool)
    {
    case CLIPBOARD_WAYLAND:
        clipboard_tool = "wl-paste";
        argv[0] = "wl-paste";
        argv[1] = "NULL";
        argv[2] = NULL;
        break;
    case CLIPBOARD_X11:
        clipboard_tool = "xclip";
        argv[0] = "xclip";
        argv[1] = "-o";
        argv[2] = NULL;
        break;
    case CLIPBOARD_NONE:
    default:
        editor_handle_error(ERR_CLIPBOARD_TOOL,
                            "Paste error: Neither wl-paste nor xclip found. Please install one.");
        return;
    }

    editor_set_status_message("Attempting to paste using %s...", clipboard_tool);
    editor_refresh_screen();

    fflush(stdout);

    if (pipe(pipefd) == -1)
    {
        editor_handle_error(ERR_CLIPBOARD_TOOL, "Paste error: Failed to create pipe.");
        return;
    }

    pid = fork();
    if (pid == -1)
    {
        editor_handle_error(ERR_CLIPBOARD_TOOL, "Paste error: Failed to fork process.");
        close(pipefd[0]);
        close(pipefd[1]);
        return;
    }

    if (pid == 0)
    {
        close(pipefd[0]);
        dup2(pipefd[1], STDOUT_FILENO);
        close(pipefd[1]);

        execvp(clipboard_tool, argv);

        _exit(1);
    }
    else
    {
        close(pipefd[1]);

        while ((bytes_read = read(pipefd[0], buffer, sizeof(buffer) - 1)) > 0)
        {
            buffer[bytes_read] = '\0';
            for (int i = 0; i < bytes_read; ++i)
            {
                if (buffer[i] == '\n' || buffer[i] == '\r')
                {
                    editor_insert_newline();
                }
                else if (buffer[i] >= 32 && buffer[i] <= 126)
                {
                    editor_insert_char(buffer[i]);
                }
            }
        }
        close(pipefd[0]);

        int status;
        waitpid(pid, &status, 0);

        if (WIFEXITED(status) && WEXITSTATUS(status) == 0)
        {
            editor_set_status_message("Pasted from clipboard using %s.", clipboard_tool);
        }
        else
        {
            editor_set_status_message("Paste error: %s failed or returned an error.",
                                      clipboard_tool);
        }
    }
}
```

And here is an honest bug report from the real code, because this post is
about that code: the Wayland branch sets `argv[1] = "NULL"` — literally
the four characters `N`, `U`, `L`, `L` — instead of `NULL`. That means on a
Wayland system, `execvp("wl-paste", ...)` receives a garbage second
argument. It would also receive it on any system where paste ran — the
past-through (insert) side is not affected either way, so this might not
have been noticed quickly. It is exactly the kind of thing sanitizers and
code review exist to catch, and it is on my fix list.

Note also the constraints on what we insert: bytes 32–126 are inserted
as-is; newlines become line breaks. Everything else — including anything
that would be a control character — is silently dropped. That is a
deliberate sanitization so pasting binary junk cannot corrupt the buffer.

Clipboard support is also where we hit our first honest limitation: the
detection uses `system("command -v ...")`, which spawns a shell at startup.
It is fine — it runs once — but it is a smell, and a cleaner version would
use `access(3)` or `stat(3)` on the known binary paths. I will come back to
that in the limitations section.

## Copy, Cut, and Delete

With selection and clipboard in place, the key handling wires the
operations together. Ctrl+C copies the selection, Ctrl+X cuts it — both
contributed by [Paulo Ferlin](https://github.com/paulorf0) (Ctrl+C in PR
#30, Ctrl+X cut with atomic undo in PR #32), and Ctrl+A selects everything
(plus the Delete key backs up over the selection). A follow-up fix from
Paulo (PR #34) made backspace's line-merge behavior keep the cursor on the
right side of the join. Cutting is interesting because it turns a range
delete into the buffer edit of record:

```c
void editor_delete_range(EditorSelectionRange range)
{
    char* text = editor_get_selected_text(range);
    if (text == NULL)
    {
        return;
    }
    size_t len = strlen(text);

    EditorAction action = {.type = ACTION_DELETE_RANGE,
                           .row = range.start_row,
                           .col = range.start_col,
                           .line_content = text,
                           .line_len = len};
    if (E.recording_actions)
    {
        // editor_record_action() drops the action without freeing it when
        // recording is off, so only push when it will actually be kept.
        editor_record_action(action);
    }
    else
    {
        free(text);
    }

    // Avoid editor_del_char()'s select-all shortcut, which wipes the whole buffer
    // in one call and would break the loop count below.
    E.select_all_active = 0;

    E.cy = range.end_row;
    E.cx = range.end_col;

    E.recording_actions = false;
    for (size_t i = 0; i < len; i++)
    {
        editor_del_char();
    }
    E.recording_actions = true;

    E.dirty = 1;
}
```

The trick: we do not write a separate "delete N characters" routine. We
record one big action (`ACTION_DELETE_RANGE` with the exact text), then
suspend recording and walk the range with ordinary `editor_del_char`, the
same routine backspace uses. That means all the edge cases — line merges,
buffer emptying — are handled by code we already trust, and the undo log
has exactly one entry, not one per character. This "compose complex edits
out of primitive ops, but log the composite" pattern is worth stealing for
any program with undo.

## Undo and Redo

Undo/redo is where an editor earns its keep. The original undo system (PR
#23, with memory fixes and the 1000-entry capacity bump in PR #25) was
contributed by [Sushant Kataria](https://github.com/sushant-kataria)
alongside [Abhishek Krishna A M](https://github.com/Abhishek-Krishna-A-M),
who built the action management in `editor_actions.c`. The **redo**
stack — parallel to undo, cleared on new edits, bound to Ctrl+Y — came in
PR #31 from [Vedant Madane](https://github.com/VedantMadane), who also fixed
the memory leaks when the history overflows. The design is an action log:
every edit pushes an `EditorAction` record describing what happened (type,
position, character, or full line/range content). Undo reverses the action;
redo replays it. The log holds a fixed 1000 entries (`MAX_UNDO_STATES`),
which is plenty for interactive use and prevents unbounded memory growth.

The action type is a small tagged union:

```c
typedef enum
{
    ACTION_INSERT_CHAR,
    ACTION_DELETE_CHAR,
    ACTION_INSERT_NEWLINE,
    ACTION_DELETE_LINE,
    ACTION_DELETE_RANGE,
} EditorActionType;

typedef struct
{
    EditorActionType type;
    int row;
    int col;
    char character;     // For insert/delete char
    char* line_content; // For delete line/range (stores content of deleted text;
                        // for ACTION_DELETE_RANGE, '\n' marks line breaks within the range)
    size_t line_len;    // For delete line/range (stores length of deleted text)
} EditorAction;
```

Because an action can own a heap string, freeing is not optional:

```c
void editor_action_free(EditorAction* action)
{
    if (action == NULL)
    {
        return;
    }
    /* Free any strdup'd payload (ACTION_DELETE_LINE line_content, etc.). */
    if (action->line_content != NULL)
    {
        free(action->line_content);
        action->line_content = NULL;
        action->line_len = 0;
    }
}
```

The push logic has to handle the fixed-size history and the
"branching undo" case. When you undo back to some earlier state and then
make a new edit, the redo history is stale — and any action you had redone
past that point must be freed:

```c
static void editor_history_push(EditorAction* history, int* len, int* idx, EditorAction action)
{
    if (*len == MAX_UNDO_STATES)
    {
        /* Drop oldest entry and free any owned line_content to avoid leaks. */
        editor_action_free(&history[0]);
        memmove(&history[0], &history[1], (MAX_UNDO_STATES - 1) * sizeof(EditorAction));
        (*len)--;
        if (*idx > 0)
        {
            (*idx)--;
        }
    }

    history[*idx] = action;
    (*len)++;
    (*idx)++;
}

static void editor_clear_redo_history(void)
{
    for (int i = 0; i < E.redo_history_len; ++i)
    {
        editor_action_free(&E.redo_history[i]);
    }
    E.redo_history_len = 0;
    E.redo_history_idx = 0;
}
```

And the recording guard glues the edit operations to the log:

```c
void editor_record_action(EditorAction action)
{
    if (!E.recording_actions)
    {
        return;
    }

    /* A new edit branch invalidates redo; free any strdup'd payloads first. */
    editor_clear_redo_history();

    if (E.undo_history_idx < E.undo_history_len)
    {
        for (int i = E.undo_history_idx; i < E.undo_history_len; ++i)
        {
            editor_action_free(&E.undo_history[i]);
        }
        E.undo_history_len = E.undo_history_idx;
    }

    /* editor_history_push frees oldest ACTION_DELETE_LINE line_content on overflow. */
    editor_history_push(E.undo_history, &E.undo_history_len, &E.undo_history_idx, action);
}
```

Every mutating edit — insert char, delete char, newline, delete line,
delete range — starts by building an action and calling
`editor_record_action`. Undo is then a straightforward inversion: an
insert becomes a delete at the same position; a delete becomes an insert of
the stored character or content; a newline insert joins the split lines
back; a line delete re-inserts the saved line.

```c
static int editor_apply_undo_action(const EditorAction* action)
{
    switch (action->type)
    {
    case ACTION_INSERT_CHAR:
        return editor_apply_delete_char_at(action->row, action->col);

    case ACTION_DELETE_CHAR:
        /* Recorded col is cursor before backspace; deleted char was at col-1. */
        if (action->col <= 0)
        {
            return -1;
        }
        if (editor_apply_insert_char(action->row, action->col - 1, action->character) != 0)
        {
            return -1;
        }
        E.cx = action->col;
        return 0;

    case ACTION_INSERT_NEWLINE:
        E.cy = action->row;
        E.cx = action->col;
        if (E.cy < E.lines.size - 1)
        {
            EditorLine* current_line = &E.lines.elements[E.cy];
            EditorLine* next_line = &E.lines.elements[E.cy + 1];

            current_line->text =
                realloc(current_line->text, current_line->len + next_line->len + 1);
            if (current_line->text == NULL)
            {
                editor_handle_error(ERR_OUT_OF_MEMORY, "Out of memory undoing newline.");
                return -1;
            }
            memcpy(&current_line->text[current_line->len], next_line->text, next_line->len);
            current_line->len += next_line->len;
            current_line->text[current_line->len] = '\0';

            editor_lines_array_delete(&E.lines, E.cy + 1);
            E.dirty = 1;
            editor_update_syntax(E.cy);
        }
        return 0;

    case ACTION_DELETE_LINE:
        /* Backspace at col 0 joined this line into the previous one. Split it back. */
        {
            int row = action->row;
            if (row <= 0 || action->line_content == NULL)
            {
                return -1;
            }
            if (row - 1 >= E.lines.size)
            {
                return -1;
            }

            EditorLine* prev = &E.lines.elements[row - 1];
            if (prev->len < action->line_len)
            {
                return -1;
            }
            size_t split_at = prev->len - action->line_len;

            char* restored = strdup(action->line_content);
            if (restored == NULL)
            {
                editor_handle_error(ERR_OUT_OF_MEMORY, "Out of memory undoing line delete.");
                return -1;
            }

            prev->text = realloc(prev->text, split_at + 1);
            if (prev->text == NULL)
            {
                free(restored);
                editor_handle_error(ERR_OUT_OF_MEMORY, "Out of memory undoing line delete.");
                return -1;
            }
            prev->text[split_at] = '\0';
            prev->len = split_at;
            prev->hl = NULL;
            prev->hl_open_comment = 0;

            EditorLine new_line = {
                .text = restored, .len = action->line_len, .hl = NULL, .hl_open_comment = 0};
            editor_lines_array_insert(&E.lines, row, new_line);
            E.cy = row;
            E.cx = action->col;
            E.dirty = 1;
            editor_update_syntax(row - 1);
            editor_update_syntax(row);
            return 0;
        }

    case ACTION_DELETE_RANGE:
        /* Undo delete range: reinsert recorded text at the recorded position.
         * Ownership of line_content stays with the action; the caller frees it
         * after apply (editor_action_free). Characters are reinserted directly
         * with recording disabled, so no new actions are pushed here. */
        if (action->line_content == NULL)
        {
            return -1;
        }
        E.cy = action->row;
        E.cx = action->col;
        for (size_t i = 0; i < action->line_len; i++)
        {
            char ch = action->line_content[i];
            if (ch == '\n')
            {
                editor_insert_newline();
            }
            else
            {
                editor_insert_char(ch);
            }
        }
        E.dirty = 1;
        editor_update_syntax(E.cy);
        return 0;

    default:
        editor_set_status_message("Undo: Unknown action type.");
        return -1;
    }
}

static int editor_apply_redo_action(const EditorAction* action)
{
    switch (action->type)
    {
    case ACTION_INSERT_CHAR:
        return editor_apply_insert_char(action->row, action->col, action->character);

    case ACTION_DELETE_CHAR:
        /* Re-apply backspace: cursor was at col, remove char at col-1. */
        if (action->col <= 0)
        {
            return -1;
        }
        return editor_apply_delete_char_at(action->row, action->col - 1);

    case ACTION_INSERT_NEWLINE:
        return editor_apply_insert_newline(action->row, action->col);

    case ACTION_DELETE_LINE:
        return editor_apply_delete_line_join(action->row);

    case ACTION_DELETE_RANGE:
        /* Re-apply cut/delete-range: delete the same range again without
         * recording (the delete happened on undo; redo re-deletes it).
         * Reconstruct end position from the stored text: chars after the
         * first newline belong to the next line(s). */
        if (action->line_content == NULL)
        {
            return -1;
        }
        {
            int end_row = action->row;
            int end_col = action->col;
            for (size_t i = 0; i < action->line_len; i++)
            {
                if (action->line_content[i] == '\n')
                {
                    end_row++;
                    end_col = 0;
                }
                else
                {
                    end_col++;
                }
            }
            EditorSelectionRange range = {.start_row = action->row,
                                          .start_col = action->col,
                                          .end_row = end_row,
                                          .end_col = end_col};
            E.recording_actions = false;
            editor_delete_range(range);
            E.recording_actions = true;
        }
        return 0;

    default:
        editor_set_status_message("Redo: Unknown action type.");
        return -1;
    }
}
```

There is a subtle but important detail in both functions: ownership. When
undoing a `ACTION_DELETE_RANGE`, the comment says it explicitly — the
action's `line_content` stays owned by the action, and the caller frees it
later via `editor_action_free`. We must never double-free or leak on the
undo/redo boundary; every `strdup`/`malloc` has exactly one matching `free`.

Also notice what redo does for a range delete: it reconstructs the end
position by walking the stored text, then calls `editor_delete_range`
again with recording disabled. This is the "compose complex ops from
primitive ops" pattern again — redo is not a new code path, it is the same
delete routine we already trust, just called without logging.

## Error Handling: Failing Loudly, Failing Safely

An editor cannot afford to crash silently. The error handler's job: print
to stderr (for developers), show a message in the message bar (for the
user), and decide whether this error is fatal. This non-fatal error
handling — replacing `exit(1)` with graceful recovery so the editor stays
open and can save or quit — was contributed by
[Kampit Ojha](https://github.com/KampitOjha) (PR #27). Fatal errors (out of memory,
file operation failure) flip a `critical_error` flag, which the keypress
handler honors by restricting the user to two actions: save or quit.

```c
void editor_handle_error(EditorErrorCode code, const char* fmt, ...)
{
    va_list ap;
    va_start(ap, fmt);

    // 1. Print to stderr (for developers/debugging)
    fprintf(stderr, "Error [%d]: ", code);
    vfprintf(stderr, fmt, ap);
    fprintf(stderr, "\n");

    va_end(ap);

    // 2. Set editor status message (for user feedback)
    // Re-initialize va_list for vsnprintf
    va_start(ap, fmt);
    char user_message[256]; // Or a suitable size
    vsnprintf(user_message, sizeof(user_message), fmt, ap);
    editor_set_status_message("ERROR: %s", user_message);
    va_end(ap);

    // 3. Decide on termination based on error code or severity
    if (code == ERR_OUT_OF_MEMORY || code == ERR_FILE_OPERATION)
    {
        EditorConfig* E = get_editor_config();
        E->critical_error = 1;
    }
    // For non-fatal errors, simply return and let the calling function handle recovery
}
```

(This is one of the very few places where the codebase had a bug worth calling out
by name: the real `error_handler.c` calls `get_editor_config()`; if you copy this
post into your own editor, make sure the getter name matches your project. The
version in the repo is what you want.)

When `critical_error` is set, the keypress loop enters a narrow mode where the
message bar shows the red banner and only two keys do anything:

```c
if (E.critical_error)
{
    if (c == CTRL('s'))
    {
        editor_save_file();
    }
    else if (c == CTRL('q') || c == CTRL('c'))
    {
        cleanup_editor();
        exit(0);
    }
    editor_refresh_screen();
    return;
}
```

This is the "every path out of the editor is a careful path" principle. Once
memory is broken or a file failed, further edits are forbidden, but the
user's work is not lost: they can still save.

## The Makefile: Debug Builds That Catch Bugs

C code without sanitizers is flying blind. The Makefile builds three
flavors: `debug` (default), `release`, and `tsan` — the portable build
targets and macOS support were contributed by
[Enzo Gagarin](https://github.com/EnzoGagarin) (PR #29). The debug build
enables
AddressSanitizer and UndefinedBehaviorSanitizer, which catch the two bug
classes that plague editor code: out-of-bounds access and uninitialized
memory.

```makefile
CC ?= cc
PKG_CONFIG ?= pkg-config

TARGET := erwintext
SRCS := main.c editor.c file.c syntax.c ui.c error_handler.c editor_lines_array.c \
	editor_actions.c
HEADERS := $(wildcard *.h)

BUILD_DIR ?= build
DEBUG_DIR := $(BUILD_DIR)/debug
RELEASE_DIR := $(BUILD_DIR)/release
TSAN_DIR := $(BUILD_DIR)/tsan

DEBUG_OBJS := $(SRCS:%.c=$(DEBUG_DIR)/%.o)
RELEASE_OBJS := $(SRCS:%.c=$(RELEASE_DIR)/%.o)
TSAN_OBJS := $(SRCS:%.c=$(TSAN_DIR)/%.o)

DEBUG_BIN := $(DEBUG_DIR)/$(TARGET)
RELEASE_BIN := $(RELEASE_DIR)/$(TARGET)
TSAN_BIN := $(TSAN_DIR)/$(TARGET)

PREFIX ?= /usr/local
BINDIR ?= $(PREFIX)/bin
DESTDIR ?=

CPPFLAGS += -D_POSIX_C_SOURCE=200809L
WARNFLAGS := -Wall -Wextra -Wpedantic
COMMON_CFLAGS := -std=c99 $(WARNFLAGS) -MMD -MP
DEBUG_CFLAGS := -O0 -g3 -fsanitize=address,undefined -fno-omit-frame-pointer
RELEASE_CFLAGS := -O2 -DNDEBUG
TSAN_CFLAGS := -O1 -g3 -fsanitize=thread -fno-omit-frame-pointer

NCURSES_CFLAGS := $(shell $(PKG_CONFIG) --cflags ncurses 2>/dev/null)
NCURSES_LIBS := $(shell $(PKG_CONFIG) --libs ncurses 2>/dev/null)
ifeq ($(strip $(NCURSES_LIBS)),)
NCURSES_LIBS := -lncurses
endif

CPPFLAGS += $(NCURSES_CFLAGS)
LDLIBS += $(NCURSES_LIBS)

.PHONY: all debug release tsan clean distclean format format-check check install uninstall

all: debug

debug: $(DEBUG_BIN)
	cp $(DEBUG_BIN) $(TARGET)

release: $(RELEASE_BIN)
	cp $(RELEASE_BIN) $(TARGET)

tsan: $(TSAN_BIN)
	cp $(TSAN_BIN) $(TARGET)
```

The `-MMD -MP` flags generate dependency files so headers trigger rebuilds,
and `pkg-config` falls back to `-lncurses` if the ncurses dev package is
missing. The `check` target runs cppcheck, and `format-check` enforces
clang-format so the whole codebase stays uniform — that tooling came from
[Erdem Karaahmet](https://github.com/ErdemKaraahmet), who added `.clang-format`
and the CI formatting check in PR #24. Sanitizer builds are
pathological when you run them — ASan catches the exact byte where an
overflow happened, which is worth a thousand printf debugging sessions.

To build and run:

```bash
make               # debug build with ASan+UBSan
./erwintext test.c  # open a file, edit, save, and try the find + undo

make release       # optimized build
make check         # static analysis
```

## Putting It All Together: The Keypress Handler

The last big piece of the editor is the key dispatcher. It is a large
switch that routes every key to the right operation. A few cases worth
studying:

**Graceful quit with dirty-check.** Ctrl+Q asks for confirmation if the
file has unsaved changes:

```c
case CTRL('q'):
    if (E.dirty)
    {
        editor_set_status_message("WARNING! File has unsaved changes. Press "
                                  "Ctrl+Q/C again to force quit.");
        editor_refresh_screen();
        int c2 = getch();
        if (c2 != CTRL('q'))
            return;
    }
    cleanup_editor();
    exit(0);
    break;
```

**Copy/cut/select-all with feedback:** Ctrl+C copies, Ctrl+X cuts, Ctrl+A
selects everything:

```c
case CTRL('c'):
{
    EditorSelectionRange esr;
    int status = editor_get_selection_range(&esr);
    if (!status)
    {
        editor_set_status_message("Nothing to copy.");
    }
    else
    {
        char* txt = editor_get_selected_text(esr);

        if (txt != NULL)
        {
            editor_send_to_clipboard(txt, strlen(txt));
            free(txt);
        }
    }
}
break;
```

**Undo/Redo and Find dispatch.** Up and Down are remapped to
previous/next match while `find_active` is true:

```c
case CTRL('z'):
    editor_undo();
    break;
case CTRL('y'):
    editor_redo();
    break;
case CTRL('f'):
    editor_find();
    break;
case KEY_UP:
    if (E.find_active)
    {
        editor_find_next(-1);
    }
    else
    {
        editor_move_cursor(c);
        cursor_moved = true;
    }
    break;
case KEY_DOWN:
    if (E.find_active)
    {
        editor_find_next(1);
    }
    else
    {
        editor_move_cursor(c);
        cursor_moved = true;
    }
    break;
case KEY_LEFT:
case KEY_RIGHT:
    editor_move_cursor(c);
    cursor_moved = true;
    break;
```

The `cursor_moved` local variable is how the bottom of the handler
decides whether to redraw:

```c
    if (E.dirty || cursor_moved || original_cx != E.cx || original_cy != E.cy ||
        time(NULL) - status_message_time < 5)
    {
        editor_refresh_screen();
    }
```

The message-bar timeout (5 seconds, from `STATUS_MESSAGE_TIMEOUT_SECONDS`)
keeps the redraw loop from running every keystroke for messages that have
gone stale. This is the "paint only when needed" discipline; it is what
makes a terminal editor smooth even over slow SSH.

**Mouse handling is just another input source** (we enabled
`ALL_MOUSE_EVENTS`): clicks position the cursor, the wheel scrolls the
viewport. ncurses gives us the event; we do the math. This is the
"bonus" feature that makes the editor feel like a real app on a modern
desktop.

There is one more habit in this handler worth naming: the cleanup of
selection state is a *blacklist* — a long condition that clears the
selection for any key *except* the shift-navigation and copy/cut keys.
The codebase has a comment admitting this might not handle every edge
case, and it is right; a whitelist or an explicit `editor_clear_selection()`
call in each relevant case would be more robust. That comment is honest
engineering, and it is a good reminder that "I know this is fragile but it
works" is a legitimate — if temporary — state for a tool.

## What ErwinText Does Not Do (Yet)

Every real project has a list. Here is mine, in rough order of annoyance:

1. **Multi-line cut is unreliable.** Cutting a selection that spans a
   line break sometimes deletes the wrong characters. It is tracked; it is
   the next bug I want to fix. When you hit it in the current build, the
   honest workaround is: select within one line, cut, then delete the rest.

2. **No column and row numbers.** A status bar with row numbers is the
   single most-requested feature in editors, and mine does not have it yet. The
   rendering and scroll code already know the numbers; it is just a matter of
   painting them.

3. **No save-as filename editing in the UI.** `editor_prompt` can ask for a
   filename, but the save path only prompts when no filename is set. A
   proper "save as" keybinding is missing.

4. **No autosave, no atomic save.** Saving truncates the file in place; a
   crash mid-write can lose data. The fix is write-to-temp + rename, which
   is a well-known pattern and a good next feature.

5. **Search has no regex.** The find is literal `strstr` only. A regex
   engine like POSIX `regex.h` would be a big upgrade with a modest
   footprint.

6. **Tab stops are a constant.** `TAB_STOP` is 4; there is no per-file or
   per-user configuration. Same for the color scheme — the color pairs are
   hardcoded in `init_editor`.

7. **Syntax highlighting is line-based, not token-based.** Strings that
   span lines, nested comments, and heredocs are not handled. A real
   tokenizer would fix that but costs real complexity.

8. **No Unicode width handling.** `len` is byte length; a multibyte UTF-8
   sequence such as 'é' occupies two bytes but one display cell, which
   breaks cursor math and rendering for non-ASCII text. This is the
   classic case where "C is simple" and "C is correct" part ways.

9. **No config file, no command palette, no multiple files/tabs, no
   macros.** All of them are out of scope for a project whose whole pitch
   is "a few thousand lines you can read in an afternoon."

That list is not a confession; it is a roadmap. Every item is a feature
you can add, and adding them is the best way to keep learning C. If you
ship one improvement a month, in a year you have a genuinely personal
editor.

## Where To Go From Here

You now know everything you need to write an editor of your own. The
complete ErwinText source is MIT-licensed on GitHub at
[andrewthecodertx/c-text-editor](https://github.com/andrewthecodertx/c-text-editor),
under the name **erwintext** — go read the [Makefile](https://github.com/andrewthecodertx/c-text-editor/blob/main/Makefile)
and [editor.c](https://github.com/andrewthecodertx/c-text-editor/blob/main/editor.c)
for the parts this post compressed. The code you read here is the code
that runs.

Some ideas for your own fork:

- **Add line numbers.** The scroll and render code already know the row
  offsets; painting a number gutter is maybe 30 lines.
- **Make tabs and colors configurable.** Move `TAB_STOP` and the
  `init_pair` calls into a config block you can load from a file.
- **Implement atomic save.** Write to `filename.tmp`, `fsync`, `rename`.
- **Add regex search.** `regex.h` is in POSIX, and the find machinery is
  already there.
- **Port it to wide-char mode.** ncurses' `addwstr` and `mbrtowc` will
  take you 90% of the way to proper Unicode.

Whatever you build, keep the invariants close: never zero lines, always
count the NUL terminator, free what you allocate, and make undo and redo
exact mirrors of each other. Do that, and your editor will be solid.

Write your own. It is the most personal software you will ever make.

---

_This article was written from the source of the real ErwinText editor, and
the code blocks are the actual code. You can build the whole thing with
`make` and read the rest in the repo. If your editor works, you built it;
if it does not, that is also part of the fun._

## Thanks

ErwinText would not be the editor it is without its contributors. If you
learned something from this tutorial, a lot of it came from code written by
people who showed up and shipped:

- [Paulo Ferlin](https://github.com/paulorf0) — text selection, system clipboard, copy/cut, and the cursor-join fix
- [Vedant Madane](https://github.com/VedantMadane) — redo stack and undo memory-leak fixes
- [Kampit Ojha](https://github.com/KampitOjha) — non-fatal error handling
- [Sushant Kataria](https://github.com/sushant-kataria) — undo action management and the 1000-state history
- [Abhishek Krishna A M](https://github.com/Abhishek-Krishna-A-M) — undo action management in `editor_actions.c`
- [Enzo Gagarin](https://github.com/EnzoGagarin) — portable build targets and macOS support
- [Erdem Karaahmet](https://github.com/ErdemKaraahmet) — `.clang-format` and the CI formatting check

The project is MIT-licensed and open for pull requests; the repo is
[andrewthecodertx/c-text-editor](https://github.com/andrewthecodertx/c-text-editor).
Building an editor is a great way to learn C — and contributing to one is
an even better way.

[^1]: The general pattern of a growable line buffer appears in every
terminal editor; the canonical tutorial treatment is the kilo editor by
Salvatore Sanfilippo (2016), which popularized the approach of storing a
file as an array of lines and editing that array directly.

[^2]: The `memmove` + `{NUL}` count warning is the classic C off-by-one;
the idiom "always count the terminator" is a standard piece of C folklore,
stated in various forms in Kernighan and Ritchie, _The C Programming
Language_ (Englewood Cliffs: Prentice Hall, 1988).

[^3]: ncurses is the terminal library that implements the curses API from
BSD Unix; its manual pages describe `raw`, `noecho`, and `keypad` as the
standard raw-mode trio for interactive programs.

[^4]: The Wayland and X11 clipboard tools `wl-copy`/`wl-paste` and `xclip`
are the two standard command-line clipboard utilities on Linux
desktops, documented in their respective man pages.

[^5]: `MAX_UNDO_STATES` is defined as 1000 in `editor.h` of the ErwinText
project; the design goal was "enough for real editing, small enough to
never worry about memory."

[^6]: Sanitizers (AddressSanitizer, UndefinedBehaviorSanitizer) are part
of the LLVM/Clang and GCC toolchains; LLVM's documentation describes their
memory-error and undefined-behavior detection capabilities.