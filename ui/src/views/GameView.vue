<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { fetchLeaderboard, submitScore } from "../api/scores";
import type { ScoreView } from "../api/scores";
import {
  applyTurn,
  cloneBoard,
  createInitialState,
  getMaxTile,
  hasMoves,
} from "../core/game2048.js";
import type { Direction, GameState } from "../core/game2048";

const BEST_KEY = "halo-game2048-best";
const NAME_KEY = "halo-game2048-player";

interface Snapshot {
  state: GameState;
  over: boolean;
  moves: number;
}

function readNumber(key: string): number {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function readName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

const state = ref<GameState>({
  board: createInitialState(4).board,
  score: 0,
  won: false,
});
const best = ref(readNumber(BEST_KEY));
const player = ref(readName());
const over = ref(false);
const submitted = ref(false);
const moves = ref(0);
const history = ref<Snapshot | null>(null);
const notice = ref("");
const leaderboard = ref<ScoreView[]>([]);
const boardMessage = ref("");
const maxTile = computed(() => getMaxTile(state.value.board));

function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage may be unavailable in private mode; the game still works.
  }
}

function newGame(): void {
  state.value = { board: createInitialState(4).board, score: 0, won: false };
  over.value = false;
  submitted.value = false;
  moves.value = 0;
  history.value = null;
  notice.value = "";
}

function undo(): void {
  const previous = history.value;
  if (!previous) return;
  state.value = previous.state;
  over.value = previous.over;
  moves.value = previous.moves;
  history.value = null;
  submitted.value = false;
  notice.value = "";
}

async function loadLeaderboard(): Promise<void> {
  boardMessage.value = "";
  try {
    leaderboard.value = await fetchLeaderboard(10);
    if (leaderboard.value.length === 0) boardMessage.value = "还没有人上榜，快来占个坑";
  } catch {
    leaderboard.value = [];
    boardMessage.value = "排行榜加载失败，请确认插件已启用";
  }
}

async function reportScore(): Promise<void> {
  if (submitted.value) return;
  const name = player.value.trim().slice(0, 24) || "匿名玩家";
  save(NAME_KEY, name);
  try {
    await submitScore({
      player: name,
      score: state.value.score,
      maxTile: maxTile.value,
      moves: moves.value,
      won: state.value.won,
    });
    submitted.value = true;
    notice.value = "成绩已提交到全站排行榜";
    await loadLeaderboard();
  } catch {
    notice.value = "成绩提交失败，可稍后点击「提交成绩」重试";
  }
}

async function move(direction: Direction): Promise<void> {
  if (over.value) return;
  const wasWon = state.value.won;
  const result = applyTurn(state.value, direction);
  if (!result.moved) return;

  history.value = {
    state: {
      board: cloneBoard(state.value.board),
      score: state.value.score,
      won: state.value.won,
    },
    over: over.value,
    moves: moves.value,
  };
  moves.value += 1;
  state.value = { board: result.board, score: result.score, won: result.won };
  if (result.score > best.value) {
    best.value = result.score;
    save(BEST_KEY, String(result.score));
  }
  over.value = result.over === true || !hasMoves(result.board);
  if (result.won && !wasWon && !notice.value) {
    notice.value = "达成 2048！继续挑战更高分吧";
  }
  if (over.value) await reportScore();
}

const KEY_MAP: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
  W: "up",
  S: "down",
  A: "left",
  D: "right",
};

function onKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null;
  if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
  if (target?.isContentEditable) return;
  const direction = KEY_MAP[event.key];
  if (!direction) return;
  event.preventDefault();
  void move(direction);
}

let touchStart: { x: number; y: number } | null = null;

function onTouchStart(event: TouchEvent): void {
  const touch = event.touches[0];
  if (touch) touchStart = { x: touch.clientX, y: touch.clientY };
}

function onTouchEnd(event: TouchEvent): void {
  if (!touchStart) return;
  const touch = event.changedTouches[0];
  if (!touch) return;
  const dx = touch.clientX - touchStart.x;
  const dy = touch.clientY - touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  const direction: Direction =
    Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
  void move(direction);
}

function tileClass(value: number): string {
  if (value === 0) return "";
  if (value > 2048) return "tile-super";
  return `tile-${value}`;
}

function digitClass(value: number): string {
  if (value >= 1024) return "digit-4";
  if (value >= 128) return "digit-3";
  return "digit-2";
}

onMounted(() => {
  window.addEventListener("keydown", onKeydown);
  void loadLeaderboard();
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <div class="g2048">
    <header class="g2048-header">
      <div>
        <h1>2048 小游戏</h1>
        <p>方向键 / WASD 或滑动屏幕移动方块，相同数字合并，冲上 2048。</p>
      </div>
      <div class="g2048-scores">
        <div class="score-box"><span>当前分数</span><strong>{{ state.score }}</strong></div>
        <div class="score-box"><span>历史最高</span><strong>{{ best }}</strong></div>
      </div>
    </header>

    <div class="g2048-toolbar">
      <input
        v-model="player"
        class="name-input"
        type="text"
        maxlength="24"
        placeholder="排行榜昵称（最多 24 字）"
        aria-label="排行榜昵称"
      />
      <button type="button" class="btn primary" @click="newGame">新游戏</button>
      <button type="button" class="btn" :disabled="!history" @click="undo">撤销一步</button>
      <button type="button" class="btn" :disabled="submitted" @click="reportScore">提交成绩</button>
    </div>

    <p v-if="notice" class="notice">{{ notice }}</p>

    <div class="g2048-layout">
      <div class="board-wrap">
        <div
          class="board"
          role="application"
          aria-label="2048 棋盘"
          @touchstart.passive="onTouchStart"
          @touchend.prevent="onTouchEnd"
        >
          <template v-for="(row, rowIndex) in state.board" :key="rowIndex">
            <div
              v-for="(value, colIndex) in row"
              :key="`${rowIndex}-${colIndex}`"
              class="cell"
              :class="[tileClass(value), digitClass(value)]"
            >
              <span v-if="value">{{ value }}</span>
            </div>
          </template>
          <div v-if="over" class="overlay">
            <strong>游戏结束</strong>
            <span>得分 {{ state.score }} · 最大方块 {{ maxTile }}</span>
            <button type="button" class="btn primary" @click="newGame">再来一局</button>
          </div>
        </div>
        <p class="hint">步数 {{ moves }} · 最大方块 {{ maxTile }}</p>
      </div>

      <section class="leaderboard">
        <div class="leaderboard-title">
          <h2>全站排行榜</h2>
          <button type="button" class="btn small" @click="loadLeaderboard">刷新</button>
        </div>
        <ol v-if="leaderboard.length">
          <li v-for="(item, index) in leaderboard" :key="`${item.player}-${index}-${item.score}`">
            <span class="rank">{{ index + 1 }}</span>
            <span class="name">{{ item.player }}</span>
            <span class="score">{{ item.score }}</span>
          </li>
        </ol>
        <p v-else class="empty">{{ boardMessage || "加载中…" }}</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.g2048 {
  max-width: 940px;
  margin: 0 auto;
  padding: 12px 8px 32px;
  color: inherit;
}
.g2048-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
h1 { margin: 0 0 6px; font-size: 24px; }
h2 { margin: 0; font-size: 16px; }
p { margin: 0; }
.g2048-header p { opacity: 0.7; font-size: 13px; }
.g2048-scores { display: flex; gap: 10px; }
.score-box {
  min-width: 96px;
  padding: 8px 14px;
  border-radius: 8px;
  text-align: center;
  background: rgba(127, 127, 127, 0.12);
}
.score-box span { display: block; font-size: 11px; opacity: 0.7; }
.score-box strong { display: block; font-size: 22px; }
.g2048-toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin: 18px 0 8px; }
.name-input {
  flex: 1 1 200px;
  min-width: 160px;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid rgba(127, 127, 127, 0.35);
  background: transparent;
  color: inherit;
  font-size: 13px;
}
.btn {
  padding: 8px 14px;
  border-radius: 6px;
  border: 1px solid rgba(127, 127, 127, 0.35);
  background: rgba(127, 127, 127, 0.1);
  color: inherit;
  cursor: pointer;
  font-size: 13px;
}
.btn:hover:not(:disabled) { background: rgba(127, 127, 127, 0.2); }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.btn.primary { background: #8f7a66; border-color: #8f7a66; color: #fff; }
.btn.small { padding: 4px 10px; font-size: 12px; }
.notice { margin: 10px 0; font-size: 13px; color: #d98b2b; }
.g2048-layout { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 22px; margin-top: 14px; }
.board-wrap { max-width: 460px; }
.board {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  padding: 10px;
  border-radius: 10px;
  background: #bbada0;
  aspect-ratio: 1;
  touch-action: none;
  user-select: none;
}
.cell {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: rgba(238, 228, 218, 0.35);
  font-weight: 700;
  color: #776e65;
  font-size: clamp(20px, 4vw, 38px);
}
.cell.digit-3 { font-size: clamp(17px, 3.4vw, 32px); }
.cell.digit-4 { font-size: clamp(14px, 2.8vw, 26px); }
.tile-2 { background: #eee4da; }
.tile-4 { background: #ede0c8; }
.tile-8 { background: #f2b179; color: #f9f6f2; }
.tile-16 { background: #f59563; color: #f9f6f2; }
.tile-32 { background: #f67c5f; color: #f9f6f2; }
.tile-64 { background: #f65e3b; color: #f9f6f2; }
.tile-128 { background: #edcf72; color: #f9f6f2; }
.tile-256 { background: #edcc61; color: #f9f6f2; }
.tile-512 { background: #edc850; color: #f9f6f2; }
.tile-1024 { background: #edc53f; color: #f9f6f2; }
.tile-2048, .tile-super { background: #edc22e; color: #f9f6f2; }
.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border-radius: 10px;
  background: rgba(238, 228, 218, 0.82);
  color: #776e65;
}
.overlay strong { font-size: 28px; }
.hint { margin-top: 10px; font-size: 12px; opacity: 0.7; }
.leaderboard { padding: 14px; border-radius: 10px; background: rgba(127, 127, 127, 0.09); }
.leaderboard-title { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.leaderboard ol { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
.leaderboard li { display: flex; align-items: center; gap: 10px; font-size: 13px; }
.rank { width: 20px; text-align: center; opacity: 0.6; }
.name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.score { font-weight: 700; }
.empty { font-size: 13px; opacity: 0.65; padding: 8px 0; }
@media (max-width: 720px) {
  .g2048-layout { grid-template-columns: 1fr; }
  .board-wrap { max-width: none; }
}
</style>
