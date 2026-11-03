const FLEETS = {
  4: [
    { type: "large", length: 3 },
    { type: "small", length: 2 },
  ],
  5: [
    { type: "large", length: 3 },
    { type: "small", length: 2 },
    { type: "small", length: 2 },
  ],
  6: [
    { type: "large", length: 3 },
    { type: "large", length: 3 },
    { type: "small", length: 2 },
    { type: "small", length: 2 },
  ],
};

const SHIP_SYMBOLS = {
  large: "🔵",
  small: "🟠",
};

const ROW_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function createBoard(size) {
  if (!Object.hasOwn(FLEETS, size)) {
    throw new RangeError("Board size must be 4, 5, or 6.");
  }

  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ({
      type: "empty",
      hit: false,
      hinted: false,
    })),
  );
}

function getPlacements(size, length) {
  const placements = [];

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      for (const [rowStep, columnStep] of [
        [0, 1],
        [1, 0],
      ]) {
        const endRow = row + rowStep * (length - 1);
        const endColumn = column + columnStep * (length - 1);

        if (endRow >= size || endColumn >= size) {
          continue;
        }

        placements.push(
          Array.from({ length }, (_, offset) => ({
            row: row + rowStep * offset,
            column: column + columnStep * offset,
          })),
        );
      }
    }
  }

  return placements;
}

function shuffled(items, random) {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError(
        "Random source must return a number from 0 up to, but not including, 1.",
      );
    }

    const swapIndex = Math.floor(value * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

export function createGameBoard(size, random = Math.random) {
  const board = createBoard(size);
  const ships = FLEETS[size];

  function placeShip(shipIndex) {
    if (shipIndex === ships.length) {
      return true;
    }

    const ship = ships[shipIndex];
    const candidates = shuffled(getPlacements(size, ship.length), random);

    for (const placement of candidates) {
      if (placement.some(({ row, column }) => board[row][column].type !== "empty")) {
        continue;
      }

      for (const { row, column } of placement) {
        board[row][column] = {
          type: ship.type,
          id: shipIndex + 1,
          hit: false,
        };
      }

      if (placeShip(shipIndex + 1)) {
        return true;
      }

      for (const { row, column } of placement) {
        board[row][column] = {
          type: "empty",
          hit: false,
          hinted: false,
        };
      }
    }

    return false;
  }

  if (!placeShip(0)) {
    throw new Error(`Could not place ships on a ${size}x${size} board.`);
  }

  return board;
}

function validateBoard(board) {
  if (!Array.isArray(board) || board.length === 0) {
    throw new TypeError("Board must be a non-empty square array.");
  }

  const size = board.length;
  for (const row of board) {
    if (
      !Array.isArray(row) ||
      row.length !== size ||
      row.some(
        (cell) =>
          !cell ||
          !["empty", "small", "large"].includes(cell.type) ||
          typeof cell.hit !== "boolean",
      )
    ) {
      throw new TypeError("Board must be a square array of valid cells.");
    }
  }
}

export function printBoard(board, debug = false) {
  validateBoard(board);

  const table = Object.fromEntries(
    board.map((row, rowIndex) => [
      ROW_LABELS[rowIndex],
      row.map((cell) => {
        if (cell.hit) {
          return SHIP_SYMBOLS[cell.type] ?? "❗";
        }

        return (debug || cell.hinted) && cell.type !== "empty"
          ? SHIP_SYMBOLS[cell.type]
          : "-";
      }),
    ]),
  );

  console.table(table);
}

export function parseGuess(guess, size) {
  if (typeof guess !== "string" || !Number.isInteger(size)) {
    return null;
  }

  const match = /^([A-Z])(\d+)$/i.exec(guess.trim());
  if (!match) {
    return null;
  }

  const row = match[1].toUpperCase().charCodeAt(0) - "A".charCodeAt(0);
  const column = Number(match[2]);

  if (row < 0 || row >= size || column < 0 || column >= size) {
    return null;
  }

  return { row, column };
}

export function makeGuess(board, guess) {
  validateBoard(board);

  const position = parseGuess(guess, board.length);
  if (!position) {
    return { status: "invalid" };
  }

  const cell = board[position.row][position.column];
  if (cell.hit) {
    return { status: "repeated" };
  }

  cell.hit = true;
  cell.hinted = false;
  const status = cell.type === "empty" ? "miss" : "hit";
  const won = board.every((row) =>
    row.every((boardCell) => boardCell.type === "empty" || boardCell.hit),
  );

  return { status, type: cell.type, won };
}

export function makeCannonShot(board, guesses) {
  validateBoard(board);
  if (!Array.isArray(guesses) || guesses.length !== 2) {
    throw new TypeError("A cannon shot requires exactly two guesses.");
  }

  const positions = guesses.map((guess) => parseGuess(guess, board.length));
  if (positions.some((position) => position === null)) {
    return { status: "invalid" };
  }

  const [first, second] = positions;
  if (
    (first.row === second.row && first.column === second.column) ||
    positions.some((position) => board[position.row][position.column].hit)
  ) {
    return { status: "repeated" };
  }

  return {
    status: "fired",
    results: guesses.map((guess) => makeGuess(board, guess)),
  };
}

export function revealShipCell(board, type, random = Math.random) {
  validateBoard(board);
  if (!["small", "large"].includes(type)) {
    throw new TypeError('Ship type must be "small" or "large".');
  }

  const candidates = [];
  for (const [row, cells] of board.entries()) {
    for (const [column, cell] of cells.entries()) {
      if (cell.type === type && !cell.hit && !cell.hinted) {
        candidates.push({ row, column, cell });
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError(
      "Random source must return a number from 0 up to, but not including, 1.",
    );
  }

  const candidate = candidates[Math.floor(value * candidates.length)];
  candidate.cell.hinted = true;
  return { row: candidate.row, column: candidate.column };
}
