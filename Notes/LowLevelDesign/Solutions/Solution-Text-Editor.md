# 🛠️ Design a Text Editor (VS Code / Word-style) — LLD

> **Sources**: VS Code Monaco editor — [Erich Gamma & team's blog post on choosing the Piece Table](https://code.visualstudio.com/blogs/2018/03/23/text-buffer-reimplementation); Charles Crowley — *Data Structures for Text Sequences* (1998) (the foundational paper on Piece Tables, Ropes, and Gap Buffers); Hans-J. Boehm et al. — *Ropes: An Alternative to Strings* (1995); Operational Transformation — Sun & Ellis (1998); CRDTs (RGA) — Shapiro et al. (2011).

## 1. Requirements

### Functional
- Maintain a **document buffer** that supports insert/delete at any position.
- **Multiple cursors** + **selections** (start, end, anchor).
- **Copy / cut / paste**.
- **Find / replace** (literal and regex).
- **Undo / redo** with **grouping** (typing a word ⇒ one undo step, not five).
- **Syntax highlighting** (lexer-based, per language).
- **File I/O** with encoding detection (UTF-8, UTF-16, ASCII fallback).
- Smooth on **multi-megabyte** files.

### Non-Functional
- Insert/delete at arbitrary position should be **O(log n)**, not O(n).
- **Bounded memory growth** even after many edits.
- Render only the **visible viewport** (virtual scrolling).
- Per-keystroke latency **< 16 ms** (60 fps target).

## 2. Core Entities

| Entity | Responsibility |
|---|---|
| `Document` | Public façade — coordinates `Buffer`, cursors, history. |
| `Buffer` | The text data structure — see §3. |
| `Cursor` | `(line, column)` + `anchor` (for selections); a `Document` may hold many. |
| `Selection` | Range `[start, end]`. |
| `EditCommand` | `Insert`, `Delete`, `Replace` — has `execute()` and `undo()`. |
| `History` | `undoStack`, `redoStack`, `groupStack` for typing batches. |
| `Lexer` | Streams tokens for syntax highlighting (stateful across lines). |
| `Renderer` | Paints only visible lines (virtual scrolling). |

## 3. The Critical Choice: Buffer Data Structure

| Structure | Insert at pos | Move cursor | Memory pattern | Multi-cursor? | Used by |
|---|---|---|---|---|---|
| **String / `StringBuilder`** | O(n) | O(1) | One contiguous block | Bad | Toy editors only |
| **Gap Buffer** | **O(1)** at the gap | **O(n)** to move gap | Single array + a "gap" | Bad (gap can only be in one place) | **Emacs** |
| **Rope** | **O(log n)** | O(log n) | Balanced BST of small strings | OK | Some experimental editors |
| **Piece Table** | **O(log n)** with line cache | O(log n) | **Append-only add buffer** + immutable original | **Excellent** | **VS Code / Word** |

### Why VS Code chose the Piece Table (per Erich Gamma's blog post)
- **Append-only `addBuffer`** ⇒ every keystroke appends a few bytes; never mutates earlier text. Excellent for **undo** (just pop a piece descriptor).
- The **original buffer is read directly from disk**; for a 1 GB file we don't copy it — we describe it with piece descriptors.
- Each piece has an immutable identity ⇒ natural fit for **CRDTs** if you later add collaboration.

### Piece Table sketch
```text
originalBuffer: read from file  (immutable bytes)
addBuffer:      a StringBuilder (append-only)

document = a sequence of Piece descriptors
  Piece { bufferIndex, offset, length }  // 12-24 bytes each

example after typing " awesome" between "Hello" and " World":
  pieces = [
    {original, 0, 5},   // "Hello"
    {add,      0, 8},   // " awesome"
    {original, 5, 6},   // " World"
  ]
```

A **per-line index** (`lineStarts[]`) is cached on top so `getLine(n)` is O(log n) (binary search to locate the right piece).

## 4. Key Methods

```java
void   Document.insert(int pos, String text);      // O(log n) on PieceTable
void   Document.delete(int pos, int len);
String Document.getLine(int n);
String Document.getRange(int start, int end);
void   Document.undo();   void redo();
List<Match> Document.find(Pattern p);
void   Document.replace(Pattern p, String replacement);
void   Document.addCursor(int line, int col);
```

## 5. Design Patterns

| Pattern | Where | Why |
|---|---|---|
| **Command** | Every edit: `InsertCommand`, `DeleteCommand`, `ReplaceCommand` | The unit pushed onto the undo stack. |
| **Composite** | `CompositeCommand` = group of commands; e.g., typing `hello` is 5 inserts grouped into 1 | Undo reverts the whole word. |
| **Memento** | Snapshot of cursor positions / selection at the start of a command | Restore exact UI state on undo. |
| **Observer** | `Document` notifies `Renderer` and `Lexer` of `BufferChanged(range)` | Decoupled re-render of the affected lines. |
| **Strategy** | `Buffer` interface; `PieceTableBuffer`, `RopeBuffer`, `GapBuffer` are interchangeable | Swap implementations per file size or test. |
| **Visitor** | Walk a parsed syntax tree to compute folding ranges, outline, refactorings | Add behaviors without changing AST nodes. |
| **Iterator** | `LineIterator(start, end)` for the renderer | Lazy line traversal (no full materialization). |
| **Decorator** | A line of text decorated with token spans (color, font-style, underline) | Compose styling without modifying the line. |

## 6. Concurrency, Performance, and Advanced Topics

### 6.1 Undo grouping rule of thumb
- Typing alphanumerics with no pause ⇒ keep appending to the current `CompositeCommand`.
- An `Enter`, a long pause (> ~500 ms), or any **navigation** (cursor move via mouse/keyboard) ⇒ close the group, start a new one.

### 6.2 Virtual scrolling
The renderer keeps `firstVisibleLine` and `lastVisibleLine`. Only those lines (plus a small over-scan buffer) are converted into DOM/GPU cells. Scrolling shifts the window and recycles a small set of line widgets — independent of file length.

### 6.3 Incremental tokenization
The lexer is stateful (e.g., "currently inside a `/* … */` block comment"). On an edit at line `L`:
- Re-tokenize from line `L` onward.
- Stop early as soon as the new lexer state at end-of-line equals the cached state from before — nothing further can have changed.

This is why VS Code can syntax-highlight an edit in a 50,000-line file in milliseconds.

### 6.4 Multi-cursor edits
A single keystroke generates **N independent commands** (one per cursor), all wrapped in a `CompositeCommand` so they undo as one. PieceTable handles this trivially (each insert is just an append to `addBuffer` plus a piece descriptor); a Gap Buffer cannot, because the single gap would have to be moved between every pair of cursors.

### 6.5 Collaborative editing (advanced)
- **OT** (Operational Transformation, Sun & Ellis 1998): rebase concurrent operations onto a common base. Used by Google Docs.
- **CRDTs** (RGA, Shapiro et al. 2011): each character has a unique ID; merge is automatic and order-independent. The Piece Table's piece IDs map naturally to this.

## 7. Sources / Cross-Refs
- LLD-08 Behavioral Patterns (Command, Memento, Composite, Observer, Visitor, Iterator)
- LLD-07 Structural Patterns (Decorator)
- Solution-Spreadsheet.md (sister problem — Composite/Interpreter for formulas; same OT/CRDT toolkit)
- Solution-Google-Docs.md (the collaboration deep dive)
- VS Code blog post — *Text Buffer Reimplementation*
- Crowley — *Data Structures for Text Sequences* (1998)
