export type Direction = "up" | "down" | "left" | "right";

export interface Cell {
  row: number;
  col: number;
}

export interface Tile extends Cell {
  value: number;
}

export type Board = number[][];

export interface MoveResult {
  board: Board;
  moved: boolean;
  scoreGained: number;
  merges: Tile[];
}

export interface GameState {
  board: Board;
  score: number;
  won: boolean;
}

export interface TurnResult extends GameState {
  moved: boolean;
  spawned: Tile | null;
  merges: Tile[];
  scoreGained: number;
  over?: boolean;
}

export declare const DIRECTIONS: Direction[];
export declare const DEFAULT_SIZE: number;
export declare const WIN_TILE: number;

export declare function createEmptyBoard(size?: number): Board;
export declare function cloneBoard(board: Board): Board;
export declare function findEmptyCells(board: Board): Cell[];
export declare function addRandomTile(
  board: Board,
  random?: () => number
): { board: Board; added: boolean; tile: Tile | null };
export declare function createInitialState(
  size?: number,
  random?: () => number
): { board: Board; tiles: Tile[] };
export declare function moveBoard(board: Board, direction: Direction): MoveResult;
export declare function hasMoves(board: Board): boolean;
export declare function getMaxTile(board: Board): number;
export declare function isWin(board: Board, target?: number): boolean;
export declare function applyTurn(
  state: GameState,
  direction: Direction,
  random?: () => number
): TurnResult;
