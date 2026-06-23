import { createGame, getValidMoves } from '../game.js';

/**
 * Visual Debugger
 * If a test fails, this draws the board in the terminal so the developer can see the exact state.
 */

const display_board = function(board) {
    const grid = board.map(function(row) {
        return row.map(function(cell) {
            if (cell.worker) return `[W]`; // W for Worker
            if (cell.height > 0) return `[${cell.height}]`; // Number for building height
            return '[ ]'; // Empty space
        }).join(' ');
    }).join('\n');
    return `\nBoard State:\n${grid}\n`;
};


describe("Santorini Movement Engine: getValidMoves", function () {
    
    it(
        `Given an empty 5x5 board,
When a worker is placed in the exact open center,
Then the engine should return exactly 8 valid moves.`,
        function () {
            const state = createGame();
            state.board[2][2].worker = 'P1_A'; 

            const validMoves = getValidMoves(state, 2, 2);

            if (validMoves.length !== 8) {
                throw new Error(
                    "Center worker should have 8 moves, but found " + validMoves.length + "." +
                    display_board(state.board) +
                    "Actual moves returned: " + JSON.stringify(validMoves)
                );
            }
        }
    );

    it(
        `Given an empty 5x5 board,
When a worker is placed in the top-left corner,
Then the engine should return exactly 3 valid moves, enforcing boundary limits.`,
        function () {
            const state = createGame();
            state.board[0][0].worker = 'P1_A'; 

            const validMoves = getValidMoves(state, 0, 0);

            if (validMoves.length !== 3) {
                throw new Error(
                    "Corner worker should have 3 moves, but found " + validMoves.length + "." +
                    display_board(state.board) +
                    "Actual moves returned: " + JSON.stringify(validMoves)
                );
            }
        }
    );

    it(
        `Given a board with a worker in the center,
When an opponent's worker occupies an adjacent space,
Then the engine should return exactly 7 valid moves, excluding the occupied space.`,
        function () {
            const state = createGame();
            state.board[2][2].worker = 'P1_A'; 
            state.board[2][3].worker = 'P2_A'; // Opponent blocking right

            const validMoves = getValidMoves(state, 2, 2);

            // Check length
            if (validMoves.length !== 7) {
                throw new Error(
                    "Worker blocked by opponent should have 7 moves, but found " + validMoves.length + "." +
                    display_board(state.board)
                );
            }
            
            // Check specific exclusion
            const isBlockedSpaceIncluded = validMoves.some(function(move) {
                return move.r === 2 && move.c === 3;
            });
            
            if (isBlockedSpaceIncluded) {
                throw new Error(
                    "The valid moves illegally included the occupied space at [2, 3]." +
                    display_board(state.board)
                );
            }
        }
    );

    it(
        `Given a board with a worker on level 0,
When an adjacent space has a level 2 building,
Then the engine should return exactly 7 valid moves, enforcing the cliff rule.`,
        function () {
            const state = createGame();
            state.board[2][2].worker = 'P1_A';
            state.board[2][2].height = 0; 
            state.board[2][3].height = 2; // Cliff to the right

            const validMoves = getValidMoves(state, 2, 2);

            // Check length
            if (validMoves.length !== 7) {
                throw new Error(
                    "Worker facing a 2-level cliff should have 7 moves, but found " + validMoves.length + "." +
                    display_board(state.board)
                );
            }
            
            // Check specific exclusion
            const isCliffIncluded = validMoves.some(function(move) {
                return move.r === 2 && move.c === 3;
            });
            
            if (isCliffIncluded) {
                throw new Error(
                    "The valid moves illegally included the too-high cliff space at [2, 3]." +
                    display_board(state.board)
                );
            }
        }
    );

    it(
        `Given a board with a worker on a level 2 building,
When an adjacent space is capped by a dome (level 4),
Then the engine should return exactly 7 valid moves, enforcing the dome block rule.`,
        function () {
            const state = createGame();
            
            // Set up the worker on a Level 2 building
            state.board[2][2].worker = 'P1_A';
            state.board[2][2].height = 3; 

            
            // Place a Dome (Level 4) to the right
            state.board[2][3].height = 4; 

            const validMoves = getValidMoves(state, 2, 2);

            // Check length
            if (validMoves.length !== 7) {
                throw new Error(
                    "Worker facing a dome should have 7 moves, but found " + validMoves.length + "." +
                    display_board(state.board)
                );
            }
            
            // Check specific exclusion
            const isDomeIncluded = validMoves.some(function(move) {
                return move.r === 2 && move.c === 3;
            });
            
            if (isDomeIncluded) {
                throw new Error(
                    "The valid moves illegally included the domed space at [2, 3]." +
                    display_board(state.board)
                );
            }
        }
    );
});