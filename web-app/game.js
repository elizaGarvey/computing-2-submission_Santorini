/**
 * @fileoverview Santorini Game Module API - The "Model"
 * Strictly pure functions. No DOM manipulation. No global state.
 */


const BOARD_SIZE = 5;
// All 8 possible surrounding directions [row, col]
const DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
];

/**
 * Initializes a new game, setting up an empty 5x5 board, beginning the initial worker placement phase.
 * * @returns {Object}  initial state object representing the start of a new game
 */
export const createGame = () => {
    return {
        board: Array(BOARD_SIZE).fill(null).map(() => 
            Array(BOARD_SIZE).fill(null).map(() => ({
                height: 0,       
                worker: null,
                // Pick a random angle: 0, 90, 180, or 270 (fixed for rest of game)
                rotation: Math.floor(Math.random() * 4) * 90 
            }))
        ),
        currentPlayer: 'P1',     
        turnPhase: 'PLACE',     // Phases, 'PLACE', 'SELECT', 'MOVE', 'BUILD', 'GAMEOVER'
        placedWorkers: 0,        // Tracks how many of the 4 workers have been placed
        selectedWorker: null,    
        winner: null
    };
};


// PRIVATE HELPER FUNCTIONS - Low level functions

const cloneBoard = (board) => board.map(row => row.map(cell => ({ ...cell })));

const isWithinBounds = (r, c) => {
    return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
};

const isAdjacent = (r1, c1, r2, c2) => {
    const rowDiff = Math.abs(r1 - r2);
    const colDiff = Math.abs(c1 - c2);
    return (rowDiff <= 1 && colDiff <= 1) && !(rowDiff === 0 && colDiff === 0);
};

const isOccupied = (state, r, c) => {
    const cell = state.board[r][c];
   return cell.worker !== null || cell.height === 4; // 4 is a dome
};

const canMove = (state, fromR, fromC, toR, toC) => {
    if (!isWithinBounds(toR, toC)) return false;
    if (!isAdjacent(fromR, fromC, toR, toC)) return false;
    if (isOccupied(state, toR, toC)) return false;

    const currentHeight = state.board[fromR][fromC].height;
    const targetHeight = state.board[toR][toC].height;
    
    // Santorini Rule: You can jump down any number of levels, but only move up 1 level.
    return targetHeight - currentHeight <= 1;
};

const canBuild = (state, workerR, workerC, targetR, targetC) => {
    if (!isWithinBounds(targetR, targetC)) return false;
    if (!isAdjacent(workerR, workerC, targetR, targetC)) return false;
    if (isOccupied(state, targetR, targetC)) return false;
    
    return true;
};


// PUBLIC API FUNCTIONS - high level functions, export for ui to highlight cells and trigger move when clicked

/**
 * identifies all allowed adjacent spaces the selected worker can step into. 
 * Enforces Santorini movement rule, workers can move up  one level but can move down any number of levels. 
 * Workers cannot move into spaces occupied by other workers or buildings capped by a dome.
 * * @param {Object} state -  current state of the game board and player turns.
 * @param {number} r -  row coordinate of the worker looking to move.
 * @param {number} c -  column coordinate of the worker looking to move.
 * @returns {Array<Object>} list of coordinate objects {r, c} representing valid moves.
 */

export const getValidMoves = (state, r, c) => {
    return DIRECTIONS
        //translates generic directions into actual board coordinates based on where the worker currently is
        .map(([dR, dC]) => ({ r: r + dR, c: c + dC }))

        //takes those new coordinates and throws away any that are out of bounds, too high to climb, or occupied
        .filter(({ r: targetR, c: targetC }) => canMove(state, r, c, targetR, targetC));
};


/**
 * Calculates all adjacent spaces where a worker can build another level. 
 * Enforces the rule that buildings cannot be placed on occupied spaces or on top of completed domes.
 * * @param {Object} state -  current state of the game board and turns.
 * @param {number} r -  row coordinate of the worker looking to build.
 * @param {number} c -  column coordinate of the worker looking to build.
 * @returns {Array<Object>} list of coordinate objects {r, c} representing valid building spots.
 */

export const getValidBuilds = (state, r, c) => {
    return DIRECTIONS
        .map(([dR, dC]) => ({ r: r + dR, c: c + dC }))
        .filter(({ r: targetR, c: targetC }) => canBuild(state, r, c, targetR, targetC));
};


//ACTIONS - Triggered by user clicks, return a deep-cloned, brand new state.


/**
 * Mark a specific worker as the active item for the current turn, 
 * transitioning the player from selection phase into movement phase.
 * * @param {Object} state -  current state of the game board and turns.
 * @param {number} r -  row coordinate of the chosen worker.
 * @param {number} c -  column coordinate of the chosen worker.
 * @returns {Object} new game state with the worker selected and the phase transitions to movement.
 */

export const selectWorker = (state, r, c) => {
    // Pure functional state update using the spread operator
    return {
        ...state,
        turnPhase: 'MOVE',
        selectedWorker: { r, c }
    };
};

/**
 * Relocates  active worker to a new space on the board. 
 * If the worker steps up onto a Level 3 building, declare the current player the winner. 
 * Else transition the turn to building phase.
 * * @param {Object} state - current state of the game board and turns.
 * @param {number} fromR -  starting row coordinate of the worker.
 * @param {number} fromC -  starting column coordinate of the worker.
 * @param {number} toR -  destination row coordinate for the worker.
 * @param {number} toC -  destination column coordinate for the worker.
 * @returns {Object} new game state within the updated board and turn phase.
 */

export const moveWorker = (state, fromR, fromC, toR, toC) => {
    // 1. Create a pure, functional copy of the board array
    const newBoard = cloneBoard(state.board);
    
    // 2. Relocate the worker on the copied board
    const workerId = newBoard[fromR][fromC].worker;
    newBoard[fromR][fromC].worker = null;
    newBoard[toR][toC].worker = workerId;

    // 3. Check Win Condition
    if (newBoard[toR][toC].height === 3) {
        return {
            ...state,
            board: newBoard,
            turnPhase: 'GAMEOVER',
            winner: state.currentPlayer
        };
    }

    // 4. Return pure updated state, moving to BUILD phase
    return {
        ...state,
        board: newBoard,
        selectedWorker: { r: toR, c: toC },
        turnPhase: 'BUILD'
    };
};

/**
 * scans board to determine if a specific player has any possible moves.
 * @param {*} state  - board state
 * @param {*} player - player ID
 * @returns true if moves exist
 */

const hasValidMoves = (state, player) => {
    return state.board.some((row, r) => 
        row.some((cell, c) =>     // least 1 valid move
            cell.worker && 
            cell.worker.startsWith(player) && 
            getValidMoves(state, r, c).length > 0
        )
    );
};


/**
 * Constructs a new building block or dome on the targeted space. 
 * Ends the current player's turn, passes cturn to the opponent, and  checks if 
 * the new opponent is trapped with zero legal moves to trigger a win condition.
 * * @param {Object} state - current state of the game board and turns.
 * @param {number} r -  row coordinate where the block will be built.
 * @param {number} c - column coordinate where the block will be built.
 * @returns {Object} new game state reflecting the new building's height and next player's turn.
 */

export const buildBlock = (state, r, c) => {
    const newBoard = cloneBoard(state.board);
    
    // Ensure building cannot be built above 4 levels
    if (newBoard[r][c].height < 4) {
        newBoard[r][c].height += 1;
    }

    const nextPlayer = state.currentPlayer === 'P1' ? 'P2' : 'P1';

    // Create the updated state cleanly without mutating the old one
    const nextState = {
        ...state,
        board: newBoard,
        selectedWorker: null,
        turnPhase: 'SELECT',
        currentPlayer: nextPlayer
    };

    // THE BLOCKADE CHECK
    if (!hasValidMoves(nextState, nextPlayer)) {
        return {
            ...nextState,
            turnPhase: 'GAMEOVER',
            winner: state.currentPlayer // The person who just built the block wins!
        };
    }

    return nextState;
};


/**
 * Drops new worker onto the board during the initial setup phase. 
 * Once both players have placed their two workers,  transition game into Player 1's first turn.
 * * @param {Object} state -  current state of the game board and turns.
 * @param {number} r -  target row coordinate for the new worker.
 * @param {number} c - target column coordinate for the new worker.
 * @returns {Object}  new game state tracking the newly placed worker.
 */

export const placeWorker = (state, r, c) => {
    // Pure guard clause: if occupied, return the state untouched
    if (state.board[r][c].worker !== null) return state;

    const newBoard = cloneBoard(state.board);
    const workerMap = ['P1_A', 'P1_B', 'P2_A', 'P2_B'];
    
    newBoard[r][c].worker = workerMap[state.placedWorkers];
    const newPlacedWorkers = state.placedWorkers + 1;

    // Calculate the next player and phase functionally
    let nextPlayer = state.currentPlayer;
    let nextPhase = state.turnPhase;

    if (newPlacedWorkers < 2) {
        nextPlayer = 'P1';
    } else if (newPlacedWorkers < 4) {
        nextPlayer = 'P2';
    } else if (newPlacedWorkers === 4) {
        nextPhase = 'SELECT';
        nextPlayer = 'P1'; // Player 1 always makes the first actual move
    }

    return {
        ...state,
        board: newBoard,
        placedWorkers: newPlacedWorkers,
        currentPlayer: nextPlayer,
        turnPhase: nextPhase
    };
};