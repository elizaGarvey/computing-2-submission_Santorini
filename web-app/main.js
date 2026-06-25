/**
 * @fileoverview Web App Controller - The "View & Controller"
 * Handles DOM rendering, click events, and state storage.
 */
import {
    createGame,
    getValidMoves,
    getValidBuilds,
    selectWorker,
    moveWorker,
    buildBlock,
    placeWorker
} from './santorini.js';

const BOARD_SIZE = 5;

let gameState = createGame();
let highlightedCells = []; // Stores {r, c} of cells to highlight

/* ============================================================
   KEYBOARD NAVIGATION STATE — lives outside the DOM on purpose.
   render() does boardElement.innerHTML = '' every time, which
   destroys every cell (and any focus sitting on one of them), so
   the "keyboard cursor" can't live ON a cell. It lives here, as a
   plain variable, and render() re-projects it onto the new DOM
   after every rebuild.
   ============================================================ */

// Cursor starts on the centre square of the board.
let cursor = { r: 2, c: 2 };

// Remembers which worker (by id, e.g. 'P1_A') each player used last,
// so when their turn comes back around the cursor can jump straight
// to it instead of leaving a keyboard user to hunt for it with arrows.
const lastWorkerByPlayer = { P1: null, P2: null };

// The lightest tone inside each player's worker sprite — used to colour
// the keyboard cursor outline so it reads as "your turn" instead of a
// fixed neutral colour.
const PLAYER_CURSOR_COLOR = {
    P1: '#2e2e93', // 2E2E93
    P2: '#e0b700', // E0B700
};

const boardElement = document.getElementById('game-board');
const statusElement = document.getElementById('game-status');

// Finds a worker's current square by id. A worker never moves again
// until its owner's NEXT turn, so its post-move square is exactly
// where we want to default the cursor to when that turn comes around.
const findWorkerPosition = (workerId) => {
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (gameState.board[r][c].worker === workerId) return { r, c };
        }
    }
    return null;
};

// Each player has exactly two workers, '<player>_A' and '<player>_B' —
// given one, this is how we find "the other one" to cycle to.
const getSiblingWorkerId = (workerId) => {
    const [player, letter] = workerId.split('_');
    return `${player}_${letter === 'A' ? 'B' : 'A'}`;
};

const render = () => {
    boardElement.innerHTML = '';

    // Tints the keyboard cursor outline to match the current player's
    // worker colour — set once on the board so it cascades to whichever
    // cell currently has focus, instead of needing to be set per-cell.
    boardElement.style.setProperty('--cursor-color', PLAYER_CURSOR_COLOR[gameState.currentPlayer]);

    // Safety check in case you completely deleted the HTML element
    if (statusElement) {
        statusElement.innerText = `Turn: ${gameState.currentPlayer} | Phase: ${gameState.turnPhase}`;
    }

    gameState.board.forEach((row, r) => {
        row.forEach((cell, c) => {
            const cellDiv = document.createElement('div');
            cellDiv.classList.add('cell');

            // Generate a consistent orientation (0, 1, 2, or 3) for this specific grid square
            const orientation = (r * 7 + c * 3) % 4;

            // 1. Stack the Buildings (Levels 1, 2, and 3)
            for (let level = 1; level <= Math.min(cell.height, 3); level++) {
                const blockImg = document.createElement('img');
                blockImg.src = `assets/block_${level}_${orientation}.png`;
                blockImg.classList.add('asset');
                cellDiv.appendChild(blockImg);
            }

            // 2. Add the Dome (Level 4)
            if (cell.height === 4) {
                const domeImg = document.createElement('img');
                domeImg.src = `assets/dome.png`;
                domeImg.classList.add('asset');
                cellDiv.appendChild(domeImg);
            }

            // 3. Add the Worker
            if (cell.worker) {
                const workerImg = document.createElement('img');
                // Maps worker ID to worker_1.png or worker_2.png
                const playerNum = cell.worker.includes('P1') || cell.worker.includes('1') ? '1' : '2';
                workerImg.src = `assets/worker_${playerNum}.png`;
                workerImg.classList.add('asset');
                cellDiv.appendChild(workerImg);
            }

            // --- VISUAL HIGHLIGHTS ---
            const isValidTarget = isClickValid(r, c);
            const isSelectedWorker = gameState.selectedWorker
                && gameState.selectedWorker.r === r
                && gameState.selectedWorker.c === c;

            // Highlight valid moves or builds — back to the original plain grey.
            if (isValidTarget) {
                cellDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                cellDiv.style.boxShadow = 'inset 0 0 15px rgba(255, 255, 255, 0.15)';
            }
            // Highlight currently selected worker — back to the original plain grey.
            if (isSelectedWorker) {
                cellDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
            }

            /* ---- ACCESSIBILITY: role + label --------------------------
               Built from the real cell contents so a screen reader
               announces something meaningful, not just bare coordinates. */
            cellDiv.setAttribute('role', 'gridcell');
            cellDiv.setAttribute('aria-selected', isSelectedWorker ? 'true' : 'false');
            cellDiv.setAttribute('aria-label', buildCellLabel(r, c, cell, isValidTarget));

            /* ---- ROVING TABINDEX ---------------------------------------
               Exactly ONE cell is tabbable (the cursor); every other cell
               is -1, so Tab lands on the grid once and arrows take over —
               the correct accessible-grid behaviour. */
            const isCursor = (r === cursor.r && c === cursor.c);
            cellDiv.tabIndex = isCursor ? 0 : -1;

            // Mouse click reuses the exact same handler as the keyboard's
            // Space key — there's only ever one path into the game logic.
            cellDiv.addEventListener('click', () => handleCellClick(r, c));

            // Attach it to the board
            boardElement.appendChild(cellDiv);
        });
    });

    // Re-seat the keyboard cursor onto the freshly built DOM — the
    // innerHTML wipe above destroyed whatever focus there was a moment ago.
    const idx = cursor.r * BOARD_SIZE + cursor.c;
    const cursorCell = boardElement.children[idx];
    if (cursorCell) cursorCell.focus();
};

// Describes a square for screen reader users: position, what's built
// there, who's standing on it, and whether it's currently a legal target.
const buildCellLabel = (r, c, cell, isValidTarget) => {
    let label = `Row ${r + 1}, Column ${c + 1}`;
    label += cell.height === 4 ? ', domed' : `, level ${cell.height}`;

    if (cell.worker) {
        const playerNum = cell.worker.includes('P1') ? '1' : '2';
        label += `, Player ${playerNum} worker`;
    }
    if (isValidTarget) label += ', valid target';

    return label;
};

// Helper to check if a clicked cell is in our highlighted list
const isClickValid = (r, c) => {
    return highlightedCells.some(cell => cell.r === r && cell.c === c);
};

// Interaction Handler (State Machine)
const handleCellClick = (r, c) => {
    // If the game is over, ignore all clicks on the board
    if (gameState.turnPhase === 'GAMEOVER') return;

    console.log(`Clicked Coordinate: (${r}, ${c}) | Current Phase: ${gameState.turnPhase}`);

    if (gameState.turnPhase === 'PLACE') {
        gameState = placeWorker(gameState, r, c);
    }

    else if (gameState.turnPhase === 'SELECT') {
        const cell = gameState.board[r][c];
        if (cell.worker && cell.worker.startsWith(gameState.currentPlayer)) {
            gameState = selectWorker(gameState, r, c);
            // Remember this as the player's "go-to" worker for next time
            // their turn comes around.
            lastWorkerByPlayer[gameState.currentPlayer] = cell.worker;
            highlightedCells = getValidMoves(gameState, r, c);
        }
    }

    else if (gameState.turnPhase === 'MOVE') {
        const cell = gameState.board[r][c];
        const isOwnWorker = cell.worker && cell.worker.startsWith(gameState.currentPlayer);
        const isTheSelectedWorker = gameState.selectedWorker
            && gameState.selectedWorker.r === r
            && gameState.selectedWorker.c === c;

        if (isOwnWorker && isTheSelectedWorker) {
            // A worker can't select its own square — that's not a real
            // choice. Treat it as "switch worker" instead: jump to the
            // player's other worker. Pressing Space again on THAT one
            // (without moving the cursor at all) just swaps back, so you
            // can toggle between your two workers as many times as you like.
            const otherWorkerId = getSiblingWorkerId(cell.worker);
            const otherPos = findWorkerPosition(otherWorkerId);
            if (otherPos) {
                gameState = selectWorker(gameState, otherPos.r, otherPos.c);
                lastWorkerByPlayer[gameState.currentPlayer] = otherWorkerId;
                highlightedCells = getValidMoves(gameState, otherPos.r, otherPos.c);
                cursor = otherPos; // keep the keyboard cursor pinned to the active worker
            }
        }
        else if (isOwnWorker) {
            gameState = selectWorker(gameState, r, c);
            lastWorkerByPlayer[gameState.currentPlayer] = cell.worker;
            highlightedCells = getValidMoves(gameState, r, c);
        }
        else if (isClickValid(r, c)) {
            const fromR = gameState.selectedWorker.r;
            const fromC = gameState.selectedWorker.c;
            gameState = moveWorker(gameState, fromR, fromC, r, c);
            highlightedCells = getValidBuilds(gameState, r, c);
        } else {
            gameState.turnPhase = 'SELECT';
            gameState.selectedWorker = null;
            highlightedCells = [];
        }
    }

    else if (gameState.turnPhase === 'BUILD') {
        if (isClickValid(r, c)) {
            gameState = buildBlock(gameState, r, c);
            highlightedCells = [];

            // The turn has just passed to the other player. Default the
            // keyboard cursor to whichever worker they used last time it
            // was their turn, so they don't have to hunt for it with the
            // arrow keys. Falls back to leaving the cursor where it is
            // (e.g. a player's very first SELECT turn, with no history yet).
            if (gameState.turnPhase === 'SELECT') {
                const rememberedWorker = lastWorkerByPlayer[gameState.currentPlayer];
                const rememberedPos = rememberedWorker ? findWorkerPosition(rememberedWorker) : null;
                if (rememberedPos) cursor = rememberedPos;
            }
        }
    }

    // Always re-render to show the new state
    render();

    // WIN CONDITION ALERT: Triggered if moveWorker or buildBlock returned 'GAMEOVER'
    if (gameState.turnPhase === 'GAMEOVER') {
        setTimeout(() => {
            alert(`GAME OVER! ${gameState.winner} HAS WON THE GAME!`);
        }, 10);
    }
};

/* ---- KEYDOWN: ONE listener on the board, not per-cell ---------------
   Per-cell listeners would die on every re-render since innerHTML wipes
   them out along with the cells. One listener on the container survives
   because the container itself is never wiped — only its children are. */
boardElement.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'ArrowUp':    cursor.r--; break;
        case 'ArrowDown':  cursor.r++; break;
        case 'ArrowLeft':  cursor.c--; break;
        case 'ArrowRight': cursor.c++; break;
        case ' ':
        case 'Enter':
            // Space (plus Enter, for standard grid-accessibility support)
            // does exactly what a click does — same handler, same FSM,
            // never duplicated.
            e.preventDefault(); // stop Space from scrolling the page
            handleCellClick(cursor.r, cursor.c);
            return;
        default:
            return; // ignore everything else, don't preventDefault it
    }

    // Clamp so the cursor can't walk off the 5x5 board.
    cursor.r = Math.max(0, Math.min(BOARD_SIZE - 1, cursor.r));
    cursor.c = Math.max(0, Math.min(BOARD_SIZE - 1, cursor.c));

    e.preventDefault(); // stop arrows scrolling the page
    render();            // re-render moves focus to the new cursor square
});

const init = () => {
    if (!boardElement) {
        console.error("CRASH: Cannot find an element with id='game-board' in your HTML!");
        return;
    }
    render();
};

init();