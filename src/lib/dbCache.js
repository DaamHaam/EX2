import { createStore, get, set } from 'idb-keyval';

const store = createStore('diff-belgique-tp', 'cache');

function key(type, gameId) {
  return `${type}:${gameId}`;
}

export async function cachePlayers(gameId, players) {
  await set(key('players', gameId), players, store);
}

export function loadPlayers(gameId) {
  return get(key('players', gameId), store);
}

export async function cacheScores(gameId, scores) {
  await set(key('scores', gameId), scores, store);
}

export function loadScores(gameId) {
  return get(key('scores', gameId), store);
}

export async function cachePoints(gameId, points) {
  await set(key('points', gameId), points, store);
}

export function loadPoints(gameId) {
  return get(key('points', gameId), store);
}

export async function cacheGameMeta(game) {
  await set('game-meta', game, store);
}

export function loadGameMeta() {
  return get('game-meta', store);
}
