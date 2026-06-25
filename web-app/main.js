/**
 * @fileoverview Web App Controller - The "View & Controller"
 * Unidirectional Data Flow: Action -> Dispatcher -> Reducer -> Render
 */
import {
    createGame,
    getValidMoves,
    getValidBuilds,
    selectWorker,
    moveWorker,
    buildBlock,
    placeWorker
} from "./santorini.js";

const BOARD_SIZE = 5;

// ============================================================
// 1. THE SINGLE SOURCE OF TRUTH
// ============================================================
const getValidPlacements = (board) => {
    const valid = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (!board[r][c].worker) valid.push({ r, c });
        }
    }
    return valid;
};

const initialGame = createGame();
let appState = {
    game: initialGame,
    ui: {
        highlightedCells: initialGame.turnPhase === "SETUP" ? getValidPlacements(initialGame.board) : [],
        cursor: { r: 2, c: 2 },
        lastWorkerByPlayer: { P1: null, P2: null },
        showStartScreen: true,
        gameWon: null
    }
};

const PLAYER_CURSOR_COLOR = { P1: "#2e2e93", P2: "#e0b700" };
const boardElement = document.getElementById("game-board");
const statusElement = document.getElementById("game-status");

// --- Helper Functions ---
const findWorkerPosition = (board, workerId) => {
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c].worker === workerId) return { r, c };
        }
    }
    return null;
};

const getSiblingWorkerId = (workerId) => {
    const [player, letter] = workerId.split("_");
    return `${player}_${letter === "A" ? "B" : "A"}`;
};

const isClickValid = (highlightedCells, r, c) => {
    return highlightedCells.some(cell => cell.r === r && cell.c === c);
};


// ============================================================
// 2. THE PURE REDUCER (State + Action = New State)
// ============================================================
const reduceState = (state, action) => {
    switch (action.type) {
        case "DISMISS_START":
            return {
                ...state,
                ui: {
                    ...state.ui,
                    showStartScreen: false
                }
            };

        case "RESTART_GAME":
            const newGame = createGame();
            return {
                ...state,
                game: newGame,
                ui: {
                    ...state.ui,
                    showStartScreen: false,
                    gameWon: null,
                    highlightedCells: getValidPlacements(newGame.board),
                    cursor: { r: 2, c: 2 },
                    lastWorkerByPlayer: { P1: null, P2: null }
                }
            };

        case "MOVE_CURSOR":
            return {
                ...state,
                ui: {
                    ...state.ui,
                    cursor: {
                        r: Math.max(0, Math.min(BOARD_SIZE - 1,
                            state.ui.cursor.r + action.dR)),
                        c: Math.max(0, Math.min(BOARD_SIZE - 1,
                            state.ui.cursor.c + action.dC))
                    }
                }
            };

        case "INTERACT_CELL":
            if (state.ui.showStartScreen) return state;

            // 1. Clone the current branches
            let nextGame = { ...state.game };
            let nextUI = { ...state.ui };
            const r = action.r;
            const c = action.c;

            if (nextGame.turnPhase === "GAMEOVER") return state;

            console.log(`Interacted at: (${r}, ${c}) |
                Phase: ${nextGame.turnPhase}`);

            // 2. Process logic based on phase
            if (nextGame.turnPhase === "SETUP") {
                if (isClickValid(state.ui.highlightedCells, r, c)) {
                    nextGame = placeWorker(nextGame, r, c);
                    if (nextGame.turnPhase === "SETUP") {
                        nextUI.highlightedCells = getValidPlacements(nextGame.board);
                    } else {
                        nextUI.highlightedCells = [];
                    }
                }
            }
            else if (nextGame.turnPhase === "SELECT") {
                const cell = nextGame.board[r][c];
                if (cell.worker && cell.worker.startsWith
                    (nextGame.currentPlayer)) {
                    nextGame = selectWorker(nextGame, r, c);
                    nextUI.lastWorkerByPlayer[nextGame.currentPlayer]
                    = cell.worker;
                    nextUI.highlightedCells = getValidMoves(nextGame, r, c);
                }
            }
            else if (nextGame.turnPhase === "MOVE") {
                const cell = nextGame.board[r][c];
                const isOwnWorker = cell.worker && cell.worker.startsWith
                (nextGame.currentPlayer);
                const isTheSelectedWorker = nextGame.selectedWorker &&
                                            nextGame.selectedWorker.r === r &&
                                            nextGame.selectedWorker.c === c;

                if (isOwnWorker && isTheSelectedWorker) {
                    const otherWorkerId = getSiblingWorkerId(cell.worker);
                    const otherPos = findWorkerPosition
                    (nextGame.board, otherWorkerId);
                    if (otherPos) {
                        nextGame = selectWorker
                        (nextGame, otherPos.r, otherPos.c);
                        nextUI.lastWorkerByPlayer[nextGame.currentPlayer]
                        = otherWorkerId;
                        nextUI.highlightedCells = getValidMoves
                        (nextGame, otherPos.r, otherPos.c);
                        nextUI.cursor = otherPos;
                    }
                }
                else if (isOwnWorker) {
                    nextGame = selectWorker(nextGame, r, c);
                    nextUI.lastWorkerByPlayer[nextGame.currentPlayer]
                    = cell.worker;
                    nextUI.highlightedCells = getValidMoves(nextGame, r, c);
                }
                else if (isClickValid(state.ui.highlightedCells, r, c)) {
                    const fromR = nextGame.selectedWorker.r;
                    const fromC = nextGame.selectedWorker.c;
                    nextGame = moveWorker(nextGame, fromR, fromC, r, c);
                    nextUI.highlightedCells = getValidBuilds(nextGame, r, c);
                } else {
                    nextGame.turnPhase = "SELECT";
                    nextGame.selectedWorker = null;
                    nextUI.highlightedCells = [];
                }
            }
            else if (nextGame.turnPhase === "BUILD") {
                if (isClickValid(state.ui.highlightedCells, r, c)) {
                    nextGame = buildBlock(nextGame, r, c);
                    nextUI.highlightedCells = [];

                    if (nextGame.turnPhase === "SELECT") {
                        const rememberedWorker = nextUI.lastWorkerByPlayer
                        [nextGame.currentPlayer];
                        const rememberedPos = rememberedWorker ?
                        findWorkerPosition(nextGame.board, rememberedWorker)
                        : null;
                        if (rememberedPos) nextUI.cursor = rememberedPos;
                    }
                }
            }

            if (nextGame.turnPhase === "GAMEOVER" && state.game.turnPhase !==
                "GAMEOVER") {
                nextUI.gameWon = nextGame.winner;
            }

            // 3. Return the fully formed new state
            return { game: nextGame, ui: nextUI };

        default:
            return state;
    }
};


// ============================================================
// 3. THE DISPATCHER
// ============================================================
const dispatch = (action) => {
    appState = reduceState(appState, action);
    render(appState);
};


// ============================================================
// 4. THE PURE RENDERE
// ============================================================
const render = (state) => {
    const modalOverlay = document.getElementById("modal-overlay");
    const modalImage = document.getElementById("modal-image");

    if (modalOverlay && modalImage) {
        if (state.ui.showStartScreen) {
            modalOverlay.style.display = "flex";
            modalImage.src = "assets/Start.png";
        } else if (state.game.turnPhase === "GAMEOVER") {
            modalOverlay.style.display = "flex";
            modalImage.src = state.game.winner === "P1" ? "assets/end_1.png" : "assets/end_2.png";
        } else {
            modalOverlay.style.display = "none";
        }
    }

    boardElement.innerHTML = "";
    boardElement.style.setProperty("--cursor-color", PLAYER_CURSOR_COLOR
        [state.game.currentPlayer]);

    if (statusElement) {
        statusElement.innerText = `Turn: ${state.game.currentPlayer} |
        Phase: ${state.game.turnPhase}`;
    }

    state.game.board.forEach((row, r) => {
        row.forEach((cell, c) => {
            const cellDiv = document.createElement("div");
            cellDiv.classList.add("cell");

            const orientation = (r * 7 + c * 3) % 4;

            for (let level = 1; level <= Math.min(cell.height, 3); level++) {
                const blockImg = document.createElement("img");
                blockImg.src = `assets/block_${level}_${orientation}.png`;
                blockImg.classList.add("asset");
                cellDiv.appendChild(blockImg);
            }

            if (cell.height === 4) {
                const domeImg = document.createElement("img");
                domeImg.src = `assets/dome.png`;
                domeImg.classList.add("asset");
                cellDiv.appendChild(domeImg);
            }

            if (cell.worker) {
                const workerImg = document.createElement("img");
                const playerNum = cell.worker.includes("P1") ||
                cell.worker.includes("1") ? "1": "2";
                workerImg.src = `assets/worker_${playerNum}.png`;
                workerImg.classList.add("asset");
                cellDiv.appendChild(workerImg);
            }

            const isValidTarget = isClickValid(state.ui.highlightedCells, r, c);
            const isSelectedWorker = state.game.selectedWorker &&
                                     state.game.selectedWorker.r === r &&
                                     state.game.selectedWorker.c === c;

            if (isValidTarget) {
                cellDiv.style.backgroundColor = "rgba(255, 255, 255, 0.08)";
                cellDiv.style.boxShadow =
                "inset 0 0 15px rgba(255, 255, 255, 0.15)";
            }
            if (isSelectedWorker) {
                cellDiv.style.backgroundColor = "rgba(255, 255, 255, 0.15)";
            }

            cellDiv.setAttribute("role", "gridcell");
            cellDiv.setAttribute("aria-selected",
                isSelectedWorker ? "true" : "false");
            cellDiv.setAttribute("aria-label", buildCellLabel
                (r, c, cell, isValidTarget));

            const isCursor =
            (r === state.ui.cursor.r && c === state.ui.cursor.c);
            cellDiv.tabIndex = isCursor ? 0 : -1;

            // ACTION: Dispatch instead of direct logic
            cellDiv.addEventListener("click", () => dispatch
            ({ type: "INTERACT_CELL", r, c }));

            boardElement.appendChild(cellDiv);
        });
    });

    const idx = state.ui.cursor.r * BOARD_SIZE + state.ui.cursor.c;
    const cursorCell = boardElement.children[idx];
    if (cursorCell) cursorCell.focus();
};

const buildCellLabel = (r, c, cell, isValidTarget) => {
    let label = `Row ${r + 1}, Column ${c + 1}`;
    label += cell.height === 4 ? ", domed" : ", level ${cell.height}";

    if (cell.worker) {
        const playerNum = cell.worker.includes("P1") ? "1" : "2";
        label += `, Player ${playerNum} worker`;
    }
    if (isValidTarget) label += ", valid target";

    return label;
};


// ============================================================
// 5. EVENT LISTENERS (Dumb Inputs)
// ============================================================
boardElement.addEventListener("keydown", (e) => {
    switch (e.key) {
        case "ArrowUp":    dispatch
        ({ type: "MOVE_CURSOR", dR: -1, dC: 0 }); break;
        case "ArrowDown":  dispatch
        ({ type: "MOVE_CURSOR", dR: 1, dC: 0 }); break;
        case "ArrowLeft":  dispatch
        ({ type: "MOVE_CURSOR", dR: 0, dC: -1 }); break;
        case "ArrowRight": dispatch
        ({ type: "MOVE_CURSOR", dR: 0, dC: 1 }); break;
        case " ":
            e.preventDefault();
            dispatch({ type: "INTERACT_CELL",
                r: appState.ui.cursor.r, c: appState.ui.cursor.c });
            return;
        default:
            return;
    }
    e.preventDefault();
});

const init = () => {
    if (!boardElement) {
        console.error("CRASH: Cannot find an element with id='game-board'");
        return;
    }

    const modalImage = document.getElementById("modal-image");
    if (modalImage) {
        modalImage.addEventListener("click", () => {
            if (appState.ui.showStartScreen) {
                dispatch({ type: "DISMISS_START" });
            } else if (appState.game.turnPhase === "GAMEOVER") {
                dispatch({ type: "RESTART_GAME" });
            }
        });
    }

    document.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            if (appState.ui.showStartScreen) {
                e.preventDefault();
                dispatch({ type: "DISMISS_START" });
            } else if (appState.game.turnPhase === "GAMEOVER") {
                e.preventDefault();
                dispatch({ type: "RESTART_GAME" });
            }
        }
    });

    render(appState);
};

init();