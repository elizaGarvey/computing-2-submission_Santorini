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


let gameState = createGame();
let highlightedCells = []; // Stores {r, c} of cells to highlight


const boardElement = document.getElementById('game-board');
const statusElement = document.getElementById('game-status');


const renderBoard = (state) => {
    boardElement.innerHTML = ''; 
    
    // Instructions based on the phase
    if (state.turnPhase === 'PLACE') {
        statusElement.innerText = `SETUP: ${state.currentPlayer}, PLACE YOUR WORKERS`;
    } else {
        statusElement.innerText = `TURN: ${state.currentPlayer} | PHASE: ${state.turnPhase}`;
    }

    state.board.forEach((row, rIndex) => {
        row.forEach((cell, cIndex) => {
            const cellDiv = document.createElement('div');
            cellDiv.className = 'cell';
            
            cellDiv.dataset.row = rIndex;
            cellDiv.dataset.col = cIndex;
            cellDiv.dataset.height = cell.height;
            
            //for natural variations in building orientation
            cellDiv.style.setProperty('--building-rotation', `${cell.rotation}deg`);
            
            if (cell.worker) {
                cellDiv.dataset.worker = cell.worker; 
            }

            // VISUAL SHADING: Apply a dark overlay to valid moves/builds
            const isHighlighted = highlightedCells.some(h => h.r === rIndex && h.c === cIndex);
            if (isHighlighted) {
                const overlay = document.createElement('div');
                overlay.style.position = "absolute";
                overlay.style.top = "0";
                overlay.style.left = "0";
                overlay.style.width = "100%";
                overlay.style.height = "100%";
                overlay.style.backgroundColor = "rgba(0, 0, 0, 0.05)"; 
                overlay.style.zIndex = "5"; // Above buildings, below workers
                overlay.style.pointerEvents = "none"; // Let clicks pass through to the cell
                
                cellDiv.appendChild(overlay);
                cellDiv.style.cursor = "pointer";
            }

            // VISUAL SHADING: Highlight the currently selected worker
            if (state.selectedWorker && state.selectedWorker.r === rIndex && state.selectedWorker.c === cIndex) {
                const activeOverlay = document.createElement('div');
                activeOverlay.style.position = "absolute";
                activeOverlay.style.top = "0";
                activeOverlay.style.left = "0";
                activeOverlay.style.width = "100%";
                activeOverlay.style.height = "100%";
                activeOverlay.style.backgroundColor = "rgba(255, 202, 104, 0.05)"; 
                activeOverlay.style.zIndex = "5";
                activeOverlay.style.pointerEvents = "none";
                
                cellDiv.appendChild(activeOverlay);
            }

            cellDiv.addEventListener('click', () => handleCellClick(rIndex, cIndex));
            boardElement.appendChild(cellDiv);
        });
    });
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
            highlightedCells = getValidMoves(gameState, r, c);
        }
    } 
    
    else if (gameState.turnPhase === 'MOVE') {
        const cell = gameState.board[r][c];
        if (cell.worker && cell.worker.startsWith(gameState.currentPlayer)) {
            gameState = selectWorker(gameState, r, c);
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
        }
    }

    // Always re-render to show the new state
    renderBoard(gameState);

    // WIN CONDITION ALERT: Triggered if moveWorker or buildBlock returned 'GAMEOVER'
    if (gameState.turnPhase === 'GAMEOVER') {
        setTimeout(() => {
            alert(`GAME OVER! ${gameState.winner} HAS WON THE GAME!`);
        }, 10);
    }
};

const init = () => {
    if (!boardElement) {
        console.error("CRASH: Cannot find an element with id='game-board' in your HTML!");
        return;
    }
    if (!statusElement) {
        console.error("CRASH: Cannot find an element with id='game-status' in your HTML!");
        return;
    }
    renderBoard(gameState);
};

init();