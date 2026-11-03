import {
  createGameBoard,
  makeCannonShot,
  makeGuess,
  revealShipCell,
} from "./battleship.js";

const SAVE_KEY = "battleship-fleet-command-progress";

const fleets = {
  4: [
    { name: "Large ship", symbol: "🔵", count: 1, length: 3 },
    { name: "Small ship", symbol: "🟠", count: 1, length: 2 },
  ],
  5: [
    { name: "Large ship", symbol: "🔵", count: 1, length: 3 },
    { name: "Small ship", symbol: "🟠", count: 2, length: 2 },
  ],
  6: [
    { name: "Large ship", symbol: "🔵", count: 2, length: 3 },
    { name: "Small ship", symbol: "🟠", count: 2, length: 2 },
  ],
};

const modes = {
  easy: { name: "Easy", missLimit: 0 },
  normal: { name: "Normal", missLimit: 5 },
  hard: { name: "Hard", missLimit: 3 },
};

const boardElement = document.querySelector("#board");
const boardTitle = document.querySelector("#board-title");
const turnCount = document.querySelector("#turn-count");
const missCount = document.querySelector("#miss-count");
const missProgress = document.querySelector("#miss-progress");
const message = document.querySelector("#message");
const fleetList = document.querySelector("#fleet-list");
const fleetTotal = document.querySelector("#fleet-total");
const startButton = document.querySelector("#start-button");
const sizeButtons = [...document.querySelectorAll(".size-option")];
const modeButtons = [...document.querySelectorAll(".mode-option")];
const streakElement = document.querySelector("#win-streak");
const flareButton = document.querySelector("#flare-button");
const flareCount = document.querySelector("#flare-count");
const pirateButton = document.querySelector("#pirate-button");
const pirateCount = document.querySelector("#pirate-count");
const cannonButton = document.querySelector("#cannon-button");
const cannonCount = document.querySelector("#cannon-count");
const cannonHelp = document.querySelector("#cannon-help");
const cannonCancel = document.querySelector("#cannon-cancel");
const persistenceWarning = document.querySelector("#persistence-warning");

let selectedSize = 5;
let board = null;
let shots = 0;
let consecutiveMisses = 0;
let gameOver = false;
let cannonMode = false;
let cannonTargets = [];
let progress = loadProgress();

function showPersistenceWarning(error) {
  console.error("Could not save Battleship progress:", error);
  persistenceWarning.textContent =
    "Progress could not be saved in this browser.";
  persistenceWarning.hidden = false;
}

function loadProgress() {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved === null) {
      return {
        streak: 0,
        flares: 0,
        pirates: 0,
        cannon: 0,
        inProgress: false,
        mode: "easy",
      };
    }

    const parsed = JSON.parse(saved);
    if (
      !parsed ||
      !Number.isSafeInteger(parsed.streak) ||
      parsed.streak < 0 ||
      !Number.isSafeInteger(parsed.flares) ||
      parsed.flares < 0 ||
      !Number.isSafeInteger(parsed.pirates) ||
      parsed.pirates < 0 ||
      (parsed.cannon !== undefined &&
        (!Number.isSafeInteger(parsed.cannon) || parsed.cannon < 0)) ||
      (parsed.mode !== undefined && !Object.hasOwn(modes, parsed.mode)) ||
      typeof parsed.inProgress !== "boolean"
    ) {
      throw new TypeError("Saved Battleship progress has an invalid format.");
    }

    return {
      ...parsed,
      cannon: parsed.cannon ?? Math.max(0, parsed.streak - 5),
      mode: parsed.mode ?? "easy",
    };
  } catch (error) {
    showPersistenceWarning(error);
    return {
      streak: 0,
      flares: 0,
      pirates: 0,
      cannon: 0,
      inProgress: false,
      mode: "easy",
    };
  }
}

function saveProgress() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
    return true;
  } catch (error) {
    showPersistenceWarning(error);
    return false;
  }
}

function setMetric(element, value, label) {
  const numeric = document.createElement("span");
  numeric.className = "numeric-value";
  numeric.textContent = value;
  const text = document.createElement("span");
  text.className = "text-label";
  text.textContent = label;
  element.replaceChildren(numeric, text);
}

function updateRewards() {
  setMetric(
    streakElement,
    String(progress.streak),
    progress.streak === 1 ? "WIN" : "WINS",
  );
  flareCount.textContent = String(progress.flares);
  pirateCount.textContent = String(progress.pirates);
  flareButton.disabled =
    progress.flares === 0 || !board || gameOver || cannonMode;
  pirateButton.disabled =
    progress.pirates === 0 || !board || gameOver || cannonMode;
  cannonButton.disabled =
    progress.cannon === 0 ||
    !board ||
    board.length !== 6 ||
    gameOver ||
    cannonMode;
  cannonCount.textContent = String(progress.cannon);
  cannonHelp.hidden = !cannonMode;
  cannonCancel.hidden = !cannonMode;
  flareButton.setAttribute(
    "aria-label",
    `Use flare to reveal a large ship piece. ${progress.flares} available.`,
  );
  pirateButton.setAttribute(
    "aria-label",
    `Use pirate to reveal a small ship piece. ${progress.pirates} available.`,
  );
  cannonButton.setAttribute(
    "aria-label",
    `Use cannon blast to fire at two squares. ${progress.cannon} ${progress.cannon === 1 ? "shot" : "shots"} available. Only usable on a 6 by 6 board.`,
  );
  const missLimit = modes[progress.mode].missLimit;
  missProgress.hidden = missLimit === 0;
  if (missLimit > 0) {
    const remainingMisses = Math.max(0, missLimit - consecutiveMisses);
    setMetric(
      missProgress,
      `${consecutiveMisses} / ${missLimit}`,
      `MISSES · ${remainingMisses} UNTIL LOSS`,
    );
    missProgress.setAttribute(
      "aria-label",
      `${consecutiveMisses} of ${missLimit} consecutive misses, ${remainingMisses} until loss`,
    );
  }
  setMetric(
    missCount,
    `${consecutiveMisses} / ${missLimit || "∞"}`,
    "CONSECUTIVE MISSES",
  );
  for (const button of modeButtons) {
    const selected = button.dataset.mode === progress.mode;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
    button.disabled = progress.inProgress || progress.streak > 0;
  }
}

function renderFleet() {
  const fleet = fleets[selectedSize];
  const cellCount = fleet.reduce(
    (total, ship) => total + ship.count * ship.length,
    0,
  );
  setMetric(fleetTotal, String(cellCount).padStart(2, "0"), "CELLS");
  fleetList.replaceChildren(
    ...fleet.map((ship) => {
      const item = document.createElement("div");
      item.className = "fleet-item";
      const name = document.createElement("span");
      name.className = "fleet-name";
      const symbol = document.createElement("span");
      symbol.className = "ship-symbol";
      symbol.textContent = ship.symbol;
      const label = document.createElement("span");
      label.textContent = ship.name;
      name.append(symbol, label);
      const count = document.createElement("span");
      count.className = "ship-length";
      setMetric(count, `${ship.count} × ${ship.length}`, "CELLS");
      item.append(name, count);
      return item;
    }),
  );
}

function setMessage(text, state = "") {
  message.textContent = text;
  message.dataset.state = state;
}

function addShipEmoji(button) {
  const ship = document.createElement("span");
  ship.className = "ship-emoji";
  ship.setAttribute("aria-hidden", "true");
  ship.textContent = "🚢";
  button.append(ship);
}

function renderBoard() {
  if (!board) {
    return;
  }

  const size = board.length;
  const grid = document.createElement("div");
  grid.className = "board";
  grid.style.setProperty("--board-size", size);

  const corner = document.createElement("span");
  corner.className = "axis-label";
  corner.setAttribute("aria-hidden", "true");
  grid.append(corner);

  for (let column = 0; column < size; column += 1) {
    const label = document.createElement("span");
    label.className = "axis-label";
    label.textContent = String(column);
    grid.append(label);
  }

  for (let row = 0; row < size; row += 1) {
    const rowLabel = document.createElement("span");
    rowLabel.className = "axis-label";
    rowLabel.textContent = String.fromCharCode(65 + row);
    grid.append(rowLabel);

    for (let column = 0; column < size; column += 1) {
      const cell = board[row][column];
      const button = document.createElement("button");
      const coordinate = `${String.fromCharCode(65 + row)}${column}`;
      button.type = "button";
      button.className = "cell";
      if (cannonTargets.some((target) => target === coordinate)) {
        button.classList.add("selected-target");
      }
      button.setAttribute("aria-label", cell.hit
        ? `${coordinate}: ${cell.type === "empty" ? "miss" : `hit ${cell.type} ship`}`
        : cell.hinted
          ? `${coordinate}: revealed ${cell.type} ship piece, not yet fired on`
          : `${coordinate}: unknown`);

      if (cell.hit) {
        button.disabled = true;
        button.classList.add(
          cell.type === "empty"
            ? "miss"
            : `${cell.type}-hit`,
        );
        if (cell.type === "empty") {
          addShipEmoji(button);
          const missCross = document.createElement("span");
          missCross.className = "miss-cross";
          missCross.setAttribute("aria-hidden", "true");
          missCross.textContent = "×";
          button.append(missCross);
        } else {
          addShipEmoji(button);
        }
      } else if (cell.hinted) {
        button.classList.add(`${cell.type}-hint`);
        addShipEmoji(button);
        button.disabled = gameOver;
        if (!gameOver) {
          button.addEventListener("click", () => handleCellClick(coordinate));
        }
      } else {
        button.disabled = gameOver;
        if (!gameOver) {
          button.addEventListener("click", () => handleCellClick(coordinate));
        }
      }

      grid.append(button);
    }
  }

  boardElement.replaceChildren(grid);
  setMetric(turnCount, String(shots).padStart(2, "0"), "SHOTS");
  const missLimit = modes[progress.mode].missLimit;
  setMetric(
    missCount,
    `${consecutiveMisses} / ${missLimit || "∞"}`,
    "CONSECUTIVE MISSES",
  );
  updateRewards();
}

function completeWin() {
  gameOver = true;
  cannonMode = false;
  cannonTargets = [];
  progress.streak += 1;
  progress.inProgress = false;
  boardTitle.textContent = "Mission complete";

  if (progress.streak === 3) {
    progress.flares += 1;
    setMessage(
      `Fleet eliminated in ${shots} shots. Three-win streak! You earned a flare.`,
      "win",
    );
  } else if (progress.streak === 5) {
    progress.pirates += 1;
    setMessage(
      `Fleet eliminated in ${shots} shots. Five-win streak! You earned a pirate.`,
      "win",
    );
  } else if (progress.streak >= 6) {
    progress.cannon += 1;
    setMessage(
      `Fleet eliminated in ${shots} shots. Win streak: ${progress.streak}! You earned a cannon shot.`,
      "win",
    );
  } else {
    setMessage(
      `Fleet eliminated in ${shots} shots. Win streak: ${progress.streak}.`,
      "win",
    );
  }

  startButton.querySelector("span:first-child").textContent = "Next Game";
}

function loseMission(extraMessage = "") {
  gameOver = true;
  cannonMode = false;
  cannonTargets = [];
  progress.streak = 0;
  progress.inProgress = false;
  boardTitle.textContent = "Mission failed";
  const missLimit = modes[progress.mode].missLimit;
  setMessage(
    `Mission failed: ${missLimit} consecutive misses on ${modes[progress.mode].name}. Your win streak was reset.${extraMessage}`,
    "miss",
  );
  startButton.querySelector("span:first-child").textContent = "Try Again";
}

function fire(coordinate) {
  if (gameOver) {
    return;
  }

  const result = makeGuess(board, coordinate);
  if (result.status !== "hit" && result.status !== "miss") {
    return;
  }

  shots += 1;
  consecutiveMisses =
    result.status === "miss" ? consecutiveMisses + 1 : 0;
  if (result.won) {
    completeWin();
  } else if (
    modes[progress.mode].missLimit > 0 &&
    consecutiveMisses >= modes[progress.mode].missLimit
  ) {
    loseMission();
  } else if (result.status === "hit") {
    setMessage(`Direct hit. You found a ${result.type} ship.`, "hit");
  } else {
    const missLimit = modes[progress.mode].missLimit;
    const missText = missLimit
      ? ` ${consecutiveMisses}/${missLimit} consecutive misses.`
      : "";
    setMessage(`Splash. No ship at that coordinate.${missText}`, "miss");
  }

  saveProgress();
  renderBoard();
}

function handleCellClick(coordinate) {
  if (cannonMode) {
    selectCannonTarget(coordinate);
  } else {
    fire(coordinate);
  }
}

function selectCannonTarget(coordinate) {
  const existingIndex = cannonTargets.indexOf(coordinate);
  if (existingIndex !== -1) {
    cannonTargets.splice(existingIndex, 1);
    setMessage(
      `Cannon armed. Select two different squares (${cannonTargets.length}/2).`,
    );
    renderBoard();
    return;
  }

  cannonTargets.push(coordinate);
  if (cannonTargets.length < 2) {
    setMessage("First target locked. Select a second square for the cannon blast.");
    renderBoard();
    return;
  }

  const result = makeCannonShot(board, cannonTargets);
  if (result.status !== "fired") {
    cannonMode = false;
    cannonTargets = [];
    setMessage("Cannon targets were invalid. No ammo was used.");
    renderBoard();
    return;
  }

  progress.cannon -= 1;
  shots += result.results.length;
  cannonMode = false;
  cannonTargets = [];

  const misses = result.results.filter(
    (shotResult) => shotResult.status === "miss",
  ).length;
  const penalties = [];
  for (let miss = 0; miss < misses; miss += 1) {
    if (progress.flares > 0) {
      progress.flares -= 1;
      penalties.push("a flare");
    } else if (progress.pirates > 0) {
      progress.pirates -= 1;
      penalties.push("a pirate");
    } else if (progress.cannon > 0) {
      progress.cannon -= 1;
      penalties.push("an extra cannon shot");
    }
  }

  const allCannonShotsMissed = result.results.every(
    (shotResult) => shotResult.status === "miss",
  );
  consecutiveMisses = allCannonShotsMissed
    ? consecutiveMisses + misses
    : 0;
  const missLimit = modes[progress.mode].missLimit;
  const reachedMissLimit =
    missLimit > 0 && consecutiveMisses >= missLimit;

  if (result.results.some((shotResult) => shotResult.won)) {
    completeWin();
  } else {
    const hits = result.results.filter(
      (shotResult) => shotResult.status === "hit",
    ).length;
    const outcome =
      hits === 2
        ? "Both cannon shots hit!"
        : hits === 1
          ? "One cannon shot hit."
          : "Both cannon shots missed.";
    const penaltyText =
      penalties.length > 0
        ? ` Lost ${penalties.join(" and ")}.`
        : misses > 0
          ? " No perks or extra cannon shots remained to lose."
          : "";
    if (reachedMissLimit) {
      loseMission(penaltyText);
    } else {
      setMessage(`${outcome}${penaltyText}`, hits > 0 ? "hit" : "miss");
    }
  }

  saveProgress();
  renderBoard();
}

function armCannon() {
  if (!board || board.length !== 6 || progress.cannon === 0 || gameOver) {
    return;
  }

  const unshotCount = board.flat().filter((cell) => !cell.hit).length;
  if (unshotCount < 2) {
    setMessage("The cannon needs two unshot squares to fire.");
    return;
  }

  const confirmed = window.confirm(
    "CANNON BLAST WARNING\n\nChoose two different squares. Firing uses one cannon shot. Each missed square costs a flare first, then a pirate, then an extra cannon shot. Continue?",
  );
  if (!confirmed) {
    return;
  }

  cannonMode = true;
  cannonTargets = [];
  setMessage("Cannon armed. Select two different squares to fire.");
  renderBoard();
}

function cancelCannon() {
  cannonMode = false;
  cannonTargets = [];
  setMessage("Cannon aim canceled. No ammo was used.");
  renderBoard();
}

function useReward(type) {
  if (!board || gameOver) {
    return;
  }

  const inventoryKey = type === "large" ? "flares" : "pirates";
  if (progress[inventoryKey] === 0) {
    return;
  }

  const revealed = revealShipCell(board, type);
  if (!revealed) {
    setMessage(`No unrevealed ${type} ship pieces remain.`);
    return;
  }

  progress[inventoryKey] -= 1;
  const coordinate = `${String.fromCharCode(65 + revealed.row)}${revealed.column}`;
  setMessage(
    `${type === "large" ? "Flare" : "Pirate"} used. ${coordinate} reveals a ${type} ship piece; fire there to score the hit.`,
  );
  saveProgress();
  renderBoard();
}

function selectSize(size) {
  selectedSize = size;
  for (const button of sizeButtons) {
    const isSelected = Number(button.dataset.size) === selectedSize;
    button.classList.toggle("selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  }
  renderFleet();
}

for (const button of sizeButtons) {
  button.addEventListener("click", () =>
    selectSize(Number(button.dataset.size)),
  );
}

for (const button of modeButtons) {
  button.addEventListener("click", () => {
    if (progress.inProgress || progress.streak > 0) {
      return;
    }
    progress.mode = button.dataset.mode;
    consecutiveMisses = 0;
    saveProgress();
    updateRewards();
  });
}

flareButton.addEventListener("click", () => useReward("large"));
pirateButton.addEventListener("click", () => useReward("small"));
cannonButton.addEventListener("click", armCannon);
cannonCancel.addEventListener("click", cancelCannon);

startButton.addEventListener("click", () => {
  const abandonedMission = progress.inProgress;
  if (abandonedMission) {
    progress.streak = 0;
  }

  board = createGameBoard(selectedSize);
  shots = 0;
  consecutiveMisses = 0;
  gameOver = false;
  cannonMode = false;
  cannonTargets = [];
  progress.inProgress = true;
  boardTitle.textContent = `${selectedSize} × ${selectedSize} patrol zone`;
  startButton.querySelector("span:first-child").textContent = "Restart mission";
  setMessage(
    abandonedMission
      ? "Mission restarted. Your win streak was reset. Select a coordinate to fire."
      : "Radar active. Select a coordinate to fire.",
  );
  saveProgress();
  renderBoard();
});

if (progress.inProgress) {
  progress.streak = 0;
  progress.inProgress = false;
  saveProgress();
  setMessage("Previous mission abandoned. Your win streak was reset.");
}

renderFleet();
updateRewards();
