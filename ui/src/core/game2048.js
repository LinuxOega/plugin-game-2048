/**
 * 2048 core rules — pure functions, zero dependencies, no DOM and no I/O.
 *
 * This file is the single source of truth for the game rules:
 *  - Console UI imports it directly as an ES module.
 *  - The standalone front-end page is generated from it by scripts/build-standalone.mjs.
 *  - Node tests import it directly (ui/package.json declares type: module).
 *
 * A "board" is a size x size number matrix; 0 means an empty cell.
 * All functions return new values and never mutate their arguments.
 */

export const DIRECTIONS = ['up', 'down', 'left', 'right'];
export const DEFAULT_SIZE = 4;
export const WIN_TILE = 2048;

/** Clamp injected RNG output so a custom random() returning 1 cannot overflow. */
function unit(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(0.9999999999, Math.max(0, n));
}

export function createEmptyBoard(size = DEFAULT_SIZE) {
  if (!Number.isInteger(size) || size < 2) {
    throw new RangeError('board size must be an integer >= 2');
  }
  return Array.from({ length: size }, () => Array(size).fill(0));
}

export function cloneBoard(board) {
  return board.map((row) => row.slice());
}

export function findEmptyCells(board) {
  const cells = [];
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      if (board[row][col] === 0) cells.push({ row, col });
    }
  }
  return cells;
}

/**
 * Add one tile (90% -> 2, 10% -> 4) to a random empty cell.
 * Pass a deterministic `random` function in tests.
 */
export function addRandomTile(board, random = Math.random) {
  const empty = findEmptyCells(board);
  if (empty.length === 0) {
    return { board: cloneBoard(board), added: false, tile: null };
  }
  const index = Math.floor(unit(random()) * empty.length);
  const { row, col } = empty[index];
  const value = unit(random()) < 0.9 ? 2 : 4;
  const next = cloneBoard(board);
  next[row][col] = value;
  return { board: next, added: true, tile: { row, col, value } };
}

export function createInitialState(size = DEFAULT_SIZE, random = Math.random) {
  let board = createEmptyBoard(size);
  const first = addRandomTile(board, random);
  board = first.board;
  const second = addRandomTile(board, random);
  return { board: second.board, tiles: [first.tile, second.tile].filter(Boolean) };
}

/** Coordinates of the i-th line read in the sliding direction. */
function lineCells(size, direction, index) {
  const cells = [];
  for (let k = 0; k < size; k++) {
    switch (direction) {
      case 'left':
        cells.push({ row: index, col: k });
        break;
      case 'right':
        cells.push({ row: index, col: size - 1 - k });
        break;
      case 'up':
        cells.push({ row: k, col: index });
        break;
      case 'down':
        cells.push({ row: size - 1 - k, col: index });
        break;
      default:
        throw new RangeError(`unknown direction: ${direction}`);
    }
  }
  return cells;
}

/** Compress one line, merge each pair at most once, return gained score and merge positions. */
function slideLine(line) {
  const values = line.filter((value) => value !== 0);
  const result = [];
  const mergedIndices = [];
  let gained = 0;

  for (let i = 0; i < values.length; i++) {
    if (i + 1 < values.length && values[i] === values[i + 1]) {
      const merged = values[i] * 2;
      result.push(merged);
      gained += merged;
      mergedIndices.push(result.length - 1);
      i++;
    } else {
      result.push(values[i]);
    }
  }
  while (result.length < line.length) result.push(0);
  return { line: result, gained, mergedIndices };
}

/**
 * Apply one move. Returns a new board plus metadata used by the UI for
 * scoring and merge animations. `moved: false` means the move is a no-op.
 */
export function moveBoard(board, direction) {
  if (!DIRECTIONS.includes(direction)) {
    throw new RangeError(`unknown direction: ${direction}`);
  }
  const size = board.length;
  const next = cloneBoard(board);
  const merges = [];
  let scoreGained = 0;
  let moved = false;

  for (let i = 0; i < size; i++) {
    const cells = lineCells(size, direction, i);
    const original = cells.map(({ row, col }) => board[row][col]);
    const { line, gained, mergedIndices } = slideLine(original);
    scoreGained += gained;
    line.forEach((value, k) => {
      const { row, col } = cells[k];
      if (next[row][col] !== value) moved = true;
      next[row][col] = value;
      if (mergedIndices.includes(k)) merges.push({ row, col, value });
    });
  }
  return { board: next, moved, scoreGained, merges };
}

/** True when at least one legal move remains (empty cell or adjacent equal pair). */
export function hasMoves(board) {
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const value = board[row][col];
      if (value === 0) return true;
      if (col + 1 < board[row].length && board[row][col + 1] === value) return true;
      if (row + 1 < board.length && board[row + 1][col] === value) return true;
    }
  }
  return false;
}

export function getMaxTile(board) {
  return board.reduce((max, row) => Math.max(max, ...row), 0);
}

export function isWin(board, target = WIN_TILE) {
  return getMaxTile(board) >= target;
}

/**
 * One full turn used by both UIs: move, then (only if the board changed)
 * spawn a new tile, and report status. `state` is { board, score, won }.
 */
export function applyTurn(state, direction, random = Math.random) {
  const result = moveBoard(state.board, direction);
  if (!result.moved) {
    return { ...state, moved: false, spawned: null, merges: [], scoreGained: 0 };
  }
  const spawned = addRandomTile(result.board, random);
  const score = state.score + result.scoreGained;
  const board = spawned.board;
  return {
    board,
    score,
    won: state.won || isWin(board),
    moved: true,
    spawned: spawned.tile,
    merges: result.merges,
    scoreGained: result.scoreGained,
    over: !hasMoves(board),
  };
}
