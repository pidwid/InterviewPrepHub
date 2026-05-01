# 🛠️ Design Connect Four (LLD)

Connect Four is the **goldilocks** LLD problem — simpler than Chess but richer than Tic-Tac-Toe. It is increasingly popular at FAANG because it tests game state, win-detection algorithms, and extensibility (variable board size, multiplayer) in 45 minutes.

---

## 1. Requirements

### Functional Requirements
- Board: 6 rows × 7 columns (configurable).
- Two players take turns dropping a colored disc into a column.
- Disc falls to the lowest empty cell of that column (gravity).
- A player wins by aligning **4 discs in a row** horizontally, vertically, or diagonally.
- Detect **draw** (board full, no winner).
- Support **undo** the last move.
- Support **multiple human or AI players**.

### Non-Functional Requirements
- Each move runs in O(1) for placement; win-check should be O(1) per move (not O(N²)) — see optimization.
- Easily extend to 5-in-a-row, larger boards, or 3-player variants.

---

## 2. Class Design

```
┌─────────────────────┐        ┌─────────────────────┐
│  Game (Controller)  │◇──────▶│  Board              │
│  - players[]        │        │  - grid: Cell[R][C] │
│  - currentTurn      │        │  - heights[col]     │
│  - moveHistory      │        └─────────┬───────────┘
└──────────┬──────────┘                  │
           │ uses                        ▼
           ▼                  ┌─────────────────────┐
┌─────────────────────┐       │  Cell                │
│  WinStrategy        │       │  - state: PieceType  │
│  (Strategy)         │       └─────────────────────┘
└─────────────────────┘
           ▲
           │
┌─────────────────────┐
│  Player (abstract)  │
│  ├─ HumanPlayer     │
│  └─ AIPlayer        │
└─────────────────────┘
```

### Enums and Core Types

```java
enum PieceType { EMPTY, RED, YELLOW }
enum GameStatus { IN_PROGRESS, RED_WIN, YELLOW_WIN, DRAW }
```

### Player (Strategy / Polymorphism)

```java
abstract class Player {
    final String name;
    final PieceType piece;
    abstract int chooseColumn(Board b);   // returns column index
}

class HumanPlayer extends Player {
    int chooseColumn(Board b) { return prompt("Enter column: "); }
}

class AIPlayer extends Player {
    int chooseColumn(Board b) { return minimax(b, depth=5); }
}
```

### Board

```java
class Board {
    private final int rows, cols;
    private final PieceType[][] grid;
    private final int[] heights;        // next free row per column

    boolean isValidMove(int col) { return col >= 0 && col < cols && heights[col] < rows; }

    int dropPiece(int col, PieceType p) {
        if (!isValidMove(col)) throw new IllegalStateException();
        int row = heights[col]++;
        grid[row][col] = p;
        return row;
    }

    void undoDrop(int col) {
        int row = --heights[col];
        grid[row][col] = PieceType.EMPTY;
    }
}
```

The `heights[]` array gives **O(1) drop** without scanning the column.

---

## 3. Win Detection — The Interesting Part

Naive: scan all rows + cols + diagonals after every move (O(R·C)).

**Optimal: O(1) check from the just-placed cell.** Walk in 4 directions; the longest line through `(r, c)` is the only line that could have changed.

```java
private static final int[][] DIRS = {
    {0, 1},   // horizontal
    {1, 0},   // vertical
    {1, 1},   // diagonal /
    {1, -1}   // diagonal \
};

boolean isWinningMove(int row, int col, PieceType p) {
    for (int[] d : DIRS) {
        int count = 1
                  + countDir(row, col, d[0],  d[1],  p)
                  + countDir(row, col, -d[0], -d[1], p);
        if (count >= WIN_LENGTH) return true;
    }
    return false;
}

private int countDir(int r, int c, int dr, int dc, PieceType p) {
    int n = 0, nr = r + dr, nc = c + dc;
    while (inBounds(nr, nc) && grid[nr][nc] == p) { n++; nr += dr; nc += dc; }
    return n;
}
```

This is **O(WIN_LENGTH × 4) = O(1)** per move. Critical insight to demonstrate at a senior level.

---

## 4. Game Loop

```java
class Game {
    private final Board board;
    private final List<Player> players;
    private final Deque<Move> history = new ArrayDeque<>();
    private int turnIdx = 0;
    private GameStatus status = GameStatus.IN_PROGRESS;

    void play() {
        while (status == GameStatus.IN_PROGRESS) {
            Player p = players.get(turnIdx);
            int col = p.chooseColumn(board);
            int row = board.dropPiece(col, p.piece);
            history.push(new Move(p, row, col));

            if (board.isWinningMove(row, col, p.piece)) status = win(p);
            else if (board.isFull()) status = GameStatus.DRAW;
            else turnIdx = (turnIdx + 1) % players.size();
        }
    }

    void undo() {
        Move last = history.pop();
        board.undoDrop(last.col);
        turnIdx = (turnIdx - 1 + players.size()) % players.size();
        status = GameStatus.IN_PROGRESS;
    }
}
```

---

## 5. Design Patterns Demonstrated

| Pattern | Where |
|---------|-------|
| **Strategy** | `Player` (Human / AI / Random) |
| **State** | `GameStatus` transitions |
| **Command** | `Move` for undo/redo & replay |
| **Observer** | UI subscribes to game events (move played, win, draw) |
| **Memento** | Save/restore full board snapshot |
| **Factory** | `PlayerFactory.create(type)` |

---

## 6. Extensibility Discussion (Senior-Level)

Interviewers love to ask "now extend this to..." — be ready for:

| Extension | Code change |
|-----------|-------------|
| 5-in-a-row | Change `WIN_LENGTH` constant |
| N×M board | Constructor parameters; algorithm unchanged |
| 3rd player (different color) | `players` list size + new `PieceType` enum value |
| Online multiplayer | Move from `play()` loop to event-driven (`onMoveReceived`) + WebSocket |
| Spectator mode | Observer pattern → broadcast moves |
| Replay system | History list already there; serialize to JSON |
| AI opponent | `AIPlayer` strategy with minimax + alpha-beta + heuristic eval |

---

## 7. Concurrency (Online Multiplayer Variant)

When two players are on different servers:
- Server is the **source of truth** for the game state.
- Use a **lock per game session** to serialize move processing.
- Validate `move.turnNumber` matches the server's expected turn — rejects stale clicks and double-submits.
- Optimistic UI on the client; reconcile if server rejects.

```java
synchronized void applyMove(GameId gid, Move m) {
    Game g = games.get(gid);
    if (m.turnNumber != g.expectedTurn) throw new InvalidMoveException();
    g.applyMove(m);
    eventBus.publish(new MovePlayed(gid, m));
}
```

---

## 8. Common Pitfalls

- Looping over the entire board on every move (O(R·C) instead of O(1)).
- Forgetting gravity — putting a piece in a non-bottom row.
- Off-by-one in diagonal direction vectors.
- Not handling a full column (`heights[col] >= rows`) → `IndexOutOfBounds`.
- Mutable board passed to AI — AI mutates state during minimax. Use `Board.copy()` or undo after simulation.

---

## 9. Senior Interview Talking Points

- Why is O(1) win-check important? → 100M-cell board would otherwise crawl.
- Trade-off: 2D `int[][]` vs `BitBoard` (one `long` per player). BitBoards make win-check a single bitwise AND-shift sequence — used in real Connect Four solvers.
- Solving Connect Four: it is a **first-player-wins** game with perfect play (proved 1988). Discuss minimax + transposition tables if AI comes up.
- Persistence: store game state via Memento → JSON in DB → resume after restart.
