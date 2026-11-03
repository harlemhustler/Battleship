import { createGameBoard, makeGuess, printBoard } from "./battleship.js";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const WIN_ART = [
  "========",
  "__   _______ _   _   _    _ _____ _   _",
  "\\ \\ / /  _  | | | | | |  | |_   _| \\ | |",
  " \\ V /| | | | | | | | |  | | | |  \\| |",
  "  \\ / | | | | | | | | |/\\| | | | | . ' |",
  "  | | \\ \\_/ / |_| | \\  /\\  /_| |_| |\\  |",
  "  \\_/  \\___/ \\___/   \\/  \\/ \\___/\\_| \\_/",
  "========",
].join("\n");

async function selectBoardSize(prompt) {
  while (true) {
    const answer = (await prompt("Choose a board size (4, 5, or 6): ")).trim();
    const size = Number(answer);

    if ([4, 5, 6].includes(size)) {
      return size;
    }

    console.log("Please choose 4, 5, or 6.");
  }
}

export async function playGame() {
  const terminal = createInterface({ input: stdin, output: stdout });

  try {
    console.log("Welcome to Battleship 🚢");
    const size = await selectBoardSize((message) => terminal.question(message));
    const board = createGameBoard(size);
    let won = false;

    while (!won) {
      console.clear();
      printBoard(board);
      const guess = await terminal.question("Make a guess eg.. A1, B2, etc... ");
      const result = makeGuess(board, guess);

      if (result.status === "invalid") {
        console.log("Sorry but that is not a valid input. Use a coordinate like A0.");
      } else if (result.status === "repeated") {
        console.log("You already guessed that spot. Try another coordinate.");
      } else if (result.status === "miss") {
        console.log("Miss!");
      } else {
        console.log(`Hit! You found a ${result.type} ship.`);
      }

      won = result.won === true;
    }

    console.clear();
    printBoard(board);
    console.log(WIN_ART);
  } finally {
    terminal.close();
  }
}

playGame().catch((error) => {
  console.error("The game could not be completed:", error);
  process.exitCode = 1;
});
