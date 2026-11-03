import test from "node:test";
import assert from "node:assert/strict";
import {
  createBoard,
  createGameBoard,
  makeCannonShot,
  makeGuess,
  parseGuess,
  printBoard,
  revealShipCell,
} from "../src/battleship.js";

test("createBoard creates square boards and rejects unsupported sizes", () => {
  assert.equal(createBoard(4).length, 4);
  assert.equal(createBoard(4)[0].length, 4);
  assert.throws(() => createBoard(3), RangeError);
});

test("createGameBoard places the required fleet without overlaps", () => {
  for (const [size, expected] of [
    [4, { large: 3, small: 2 }],
    [5, { large: 3, small: 4 }],
    [6, { large: 6, small: 4 }],
  ]) {
    const board = createGameBoard(size);
    const counts = { large: 0, small: 0 };
    const ships = new Map();

    for (const [rowIndex, row] of board.entries()) {
      assert.equal(row.length, size);
      for (const [columnIndex, cell] of row.entries()) {
        assert.equal(cell.hit, false);
        if (cell.type !== "empty") {
          counts[cell.type] += 1;
          const positions = ships.get(cell.id) ?? [];
          positions.push({ row: rowIndex, column: columnIndex });
          ships.set(cell.id, positions);
        }
      }
    }

    assert.deepEqual(counts, expected);
    assert.equal(ships.size, size - 2);

    for (const positions of ships.values()) {
      const sameRow = positions.every(({ row }) => row === positions[0].row);
      const sameColumn = positions.every(
        ({ column }) => column === positions[0].column,
      );
      const ordered = sameRow
        ? positions.map(({ column }) => column).sort((a, b) => a - b)
        : positions.map(({ row }) => row).sort((a, b) => a - b);

      assert.ok(sameRow || sameColumn);
      assert.ok(
        ordered.every(
          (coordinate, index) =>
            index === 0 || coordinate === ordered[index - 1] + 1,
        ),
      );
    }
  }
});

test("printBoard hides unhit ships and reveals them in debug mode", () => {
  const board = [
    [
      { type: "large", id: 1, hit: false, hinted: true },
      { type: "small", id: 2, hit: true },
    ],
    [
      { type: "empty", hit: false },
      { type: "empty", hit: true },
    ],
  ];
  const tables = [];
  const originalTable = console.table;
  console.table = (table) => tables.push(table);

  try {
    printBoard(board);
    printBoard(board, true);
  } finally {
    console.table = originalTable;
  }

  assert.deepEqual(tables[0], {
    A: ["🔵", "🟠"],
    B: ["-", "❗"],
  });
  assert.deepEqual(tables[1], {
    A: ["🔵", "🟠"],
    B: ["-", "❗"],
  });
});

test("parseGuess accepts case-insensitive in-bounds coordinates", () => {
  assert.deepEqual(parseGuess(" b2 ", 4), { row: 1, column: 2 });
  assert.deepEqual(parseGuess("A0", 4), { row: 0, column: 0 });
  assert.equal(parseGuess("E0", 4), null);
  assert.equal(parseGuess("A4", 4), null);
  assert.equal(parseGuess("AA1", 4), null);
});

test("makeGuess records hits and misses, rejects repeats, and detects a win", () => {
  const board = [
    [
      { type: "small", id: 1, hit: false },
      { type: "small", id: 1, hit: false },
    ],
    [
      { type: "empty", hit: false },
      { type: "empty", hit: false },
    ],
  ];

  assert.deepEqual(makeGuess(board, "A0"), {
    status: "hit",
    type: "small",
    won: false,
  });
  assert.deepEqual(makeGuess(board, "A0"), { status: "repeated" });
  assert.deepEqual(makeGuess(board, "B1"), {
    status: "miss",
    type: "empty",
    won: false,
  });
  assert.equal(makeGuess(board, "A1").won, true);
});

test("revealShipCell hints one ship cell without counting it as a hit", () => {
  const board = [
    [
      { type: "large", id: 1, hit: false, hinted: false },
      { type: "large", id: 1, hit: false, hinted: false },
    ],
    [
      { type: "small", id: 2, hit: false, hinted: false },
      { type: "empty", hit: false, hinted: false },
    ],
  ];

  assert.deepEqual(revealShipCell(board, "large", () => 0), {
    row: 0,
    column: 0,
  });
  assert.equal(board[0][0].hinted, true);
  assert.equal(board[0][0].hit, false);
  assert.deepEqual(revealShipCell(board, "large", () => 0), {
    row: 0,
    column: 1,
  });
  assert.equal(revealShipCell(board, "large"), null);

  assert.deepEqual(makeGuess(board, "A0"), {
    status: "hit",
    type: "large",
    won: false,
  });
  assert.equal(board[0][0].hinted, false);
  assert.equal(revealShipCell(board, "large"), null);
});

test("revealShipCell rejects invalid ship types and random values", () => {
  const board = [
    [
      { type: "large", id: 1, hit: false, hinted: false },
      { type: "large", id: 1, hit: false, hinted: false },
    ],
    [
      { type: "empty", hit: false, hinted: false },
      { type: "empty", hit: false, hinted: false },
    ],
  ];

  assert.throws(() => revealShipCell(board, "empty"), TypeError);
  assert.throws(() => revealShipCell(board, "large", () => 1), RangeError);
  assert.equal(board[0][0].hinted, false);
});

test("makeCannonShot fires two distinct valid guesses together", () => {
  const board = [
    [
      { type: "large", id: 1, hit: false, hinted: false },
      { type: "large", id: 1, hit: false, hinted: false },
    ],
    [
      { type: "small", id: 2, hit: false, hinted: false },
      { type: "empty", hit: false, hinted: false },
    ],
  ];

  assert.deepEqual(makeCannonShot(board, ["A0", "B0"]), {
    status: "fired",
    results: [
      { status: "hit", type: "large", won: false },
      { status: "hit", type: "small", won: false },
    ],
  });
  assert.equal(board[0][0].hit, true);
  assert.equal(board[1][0].hit, true);
});

test("makeCannonShot rejects invalid, duplicate, or already-fired targets without changes", () => {
  const board = [
    [
      { type: "large", id: 1, hit: false, hinted: false },
      { type: "empty", hit: false, hinted: false },
    ],
    [
      { type: "empty", hit: true, hinted: false },
      { type: "small", id: 2, hit: false, hinted: false },
    ],
  ];

  assert.deepEqual(makeCannonShot(board, ["A0", "C0"]), {
    status: "invalid",
  });
  assert.deepEqual(makeCannonShot(board, ["A0", "A0"]), {
    status: "repeated",
  });
  assert.deepEqual(makeCannonShot(board, ["A0", "B0"]), {
    status: "repeated",
  });
  assert.equal(board[0][0].hit, false);
  assert.throws(() => makeCannonShot(board, ["A0"]), TypeError);
});
