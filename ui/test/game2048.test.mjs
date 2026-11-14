import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIRECTIONS,
  createEmptyBoard,
  cloneBoard,
  findEmptyCells,
  addRandomTile,
  createInitialState,
  moveBoard,
  hasMoves,
  getMaxTile,
  isWin,
  applyTurn,
} from '../src/core/game2048.js';

const board = (rows) => rows.map((row) => row.slice());
const seq = (values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

test('createEmptyBoard builds a square zero matrix and rejects invalid sizes', () => {
  assert.deepEqual(createEmptyBoard(2), [[0, 0], [0, 0]]);
  assert.equal(createEmptyBoard(4).length, 4);
  assert.throws(() => createEmptyBoard(1), RangeError);
  assert.throws(() => createEmptyBoard(2.5), RangeError);
});

test('core functions never mutate the input board', () => {
  const input = board([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const snapshot = cloneBoard(input);
  moveBoard(input, 'left');
  addRandomTile(input, seq([0]));
  assert.deepEqual(input, snapshot);
});

test('slide left merges each pair only once', () => {
  const b = board([[2, 2, 2, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const r = moveBoard(b, 'left');
  assert.deepEqual(r.board[0], [4, 4, 0, 0]);
  assert.equal(r.scoreGained, 8);
  assert.equal(r.moved, true);
  assert.equal(r.merges.length, 2);
});

test('a freshly merged tile cannot merge again in the same move', () => {
  const b = board([[2, 2, 4, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const r = moveBoard(b, 'left');
  assert.deepEqual(r.board[0], [4, 4, 0, 0]);
  assert.equal(r.scoreGained, 4);
  assert.deepEqual(moveBoard(r.board, 'left').board[0], [8, 0, 0, 0]);
});

test('mixed merges accumulate the correct score', () => {
  const b = board([[4, 4, 8, 8], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const r = moveBoard(b, 'left');
  assert.deepEqual(r.board[0], [8, 16, 0, 0]);
  assert.equal(r.scoreGained, 24);
});

test('no-op moves report moved=false and gain no score', () => {
  const b = board([[2, 4, 8, 16], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const r = moveBoard(b, 'left');
  assert.equal(r.moved, false);
  assert.equal(r.scoreGained, 0);
  assert.deepEqual(r.board, b);
});

test('all four directions slide and merge correctly', () => {
  const base = board([
    [2, 0, 0, 2],
    [0, 2, 2, 0],
    [0, 0, 0, 0],
    [4, 0, 0, 4],
  ]);
  assert.deepEqual(moveBoard(base, 'left').board[0], [4, 0, 0, 0]);
  assert.deepEqual(moveBoard(base, 'right').board[0], [0, 0, 0, 4]);
  assert.deepEqual(moveBoard(base, 'up').board.map((row) => row[0]), [2, 4, 0, 0]);
  assert.deepEqual(moveBoard(base, 'down').board.map((row) => row[0]), [0, 0, 2, 4]);
});

test('vertical merge direction is independent of horizontal', () => {
  const b = board([
    [2, 0, 0, 0],
    [2, 0, 0, 0],
    [4, 0, 0, 0],
    [4, 0, 0, 0],
  ]);
  const up = moveBoard(b, 'up');
  assert.deepEqual(up.board.map((row) => row[0]), [4, 8, 0, 0]);
  assert.equal(up.scoreGained, 12);
  const down = moveBoard(b, 'down');
  assert.deepEqual(down.board.map((row) => row[0]), [0, 0, 4, 8]);
  assert.equal(down.scoreGained, 12);
});

test('unknown directions are rejected', () => {
  assert.throws(() => moveBoard(createEmptyBoard(), 'diagonal'), RangeError);
  assert.equal(DIRECTIONS.length, 4);
});

test('hasMoves detects empty cells, adjacent pairs and terminal boards', () => {
  assert.equal(hasMoves(board([[0, 0], [0, 0]])), true);
  assert.equal(hasMoves(board([[2, 2], [4, 8]])), true);
  assert.equal(hasMoves(board([[2, 4], [2, 8]])), true, 'vertical equal pair is a legal move');
  assert.equal(hasMoves(board([[2, 4], [4, 2]])), false, 'diagonal equals are not mergeable');
  assert.equal(hasMoves(board([[2, 4], [8, 16]])), false);
});

test('getMaxTile and isWin', () => {
  const b = board([[2, 4], [1024, 2048]]);
  assert.equal(getMaxTile(b), 2048);
  assert.equal(isWin(b), true);
  assert.equal(isWin(b, 4096), false);
  assert.equal(getMaxTile(createEmptyBoard(3)), 0);
});

test('addRandomTile is deterministic with injected RNG and never overwrites tiles', () => {
  const b = board([[2, 0], [0, 4]]);
  const r = addRandomTile(b, seq([0, 0]));
  assert.equal(r.added, true);
  assert.deepEqual(r.tile, { row: 0, col: 1, value: 2 });
  assert.deepEqual(r.board, [[2, 2], [0, 4]]);
  assert.equal(r.board[1][1], 4);

  const four = addRandomTile(b, seq([0, 0.95]));
  assert.equal(four.tile.value, 4);

  const full = board([[2, 4], [8, 16]]);
  const none = addRandomTile(full, seq([0]));
  assert.equal(none.added, false);
  assert.equal(none.tile, null);
  assert.deepEqual(none.board, full);
});

test('RNG returning 1 does not overflow the empty-cell index', () => {
  const b = board([[2, 0], [0, 0]]);
  assert.doesNotThrow(() => addRandomTile(b, () => 1));
});

test('findEmptyCells returns all coordinates in row-major order', () => {
  assert.deepEqual(findEmptyCells(board([[2, 0], [0, 4]])), [
    { row: 0, col: 1 },
    { row: 1, col: 0 },
  ]);
});

test('createInitialState starts with exactly two tiles', () => {
  const state = createInitialState(4, seq([0.1, 0.1, 0.9, 0.1]));
  assert.equal(findEmptyCells(state.board).length, 14);
  assert.equal(state.tiles.length, 2);
});

test('applyTurn spawns a tile only after a legal move and accumulates score', () => {
  const initial = {
    board: board([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]),
    score: 0,
    won: false,
  };
  const after = applyTurn(initial, 'left', seq([0.99, 0]));
  assert.equal(after.moved, true);
  assert.equal(after.score, 4);
  assert.equal(after.scoreGained, 4);
  assert.equal(findEmptyCells(after.board).length, 14);
  assert.equal(after.spawned.value, 2);
  assert.equal(initial.score, 0, 'original state is untouched');
});

test('applyTurn on a no-op move keeps score, board and spawn untouched', () => {
  const initial = {
    board: board([[2, 4, 8, 16], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]),
    score: 40,
    won: false,
  };
  const after = applyTurn(initial, 'left', seq([0]));
  assert.equal(after.moved, false);
  assert.equal(after.score, 40);
  assert.equal(after.spawned, null);
  assert.deepEqual(after.board, initial.board);
});

test('applyTurn reports game over on a terminal board', () => {
  // After the merge exactly one empty cell remains; spawning 2 fills a board
  // where no equal neighbours exist, so no further move is possible.
  const initial = {
    board: board([
      [2, 2, 8],
      [8, 16, 32],
      [64, 128, 256],
    ]),
    score: 0,
    won: false,
  };
  const after = applyTurn(initial, 'left', seq([0, 0.1]));
  assert.equal(after.moved, true);
  assert.equal(after.spawned.value, 2);
  assert.deepEqual(after.board, [
    [4, 8, 2],
    [8, 16, 32],
    [64, 128, 256],
  ]);
  assert.equal(hasMoves(after.board), false);
  assert.equal(after.over, true);
});

test('applyTurn detects a win at 2048', () => {
  const initial = {
    board: board([[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]),
    score: 0,
    won: false,
  };
  const after = applyTurn(initial, 'left', seq([0.5, 0.1]));
  assert.equal(getMaxTile(after.board), 2048);
  assert.equal(after.won, true);
  assert.equal(after.score, 2048);
});
