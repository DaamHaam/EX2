import { useCallback, useEffect, useMemo, useState } from 'react';
import { PlayerCard } from './components/PlayerCard.jsx';
import { CommentDialog } from './components/CommentDialog.jsx';
import { StatusBanner } from './components/StatusBanner.jsx';
import { HistoryList } from './components/HistoryList.jsx';
import { UpdateBanner } from './components/UpdateBanner.jsx';
import {
  addPoint,
  createGameWithPlayers,
  deletePoint,
  fetchPlayers,
  fetchPoints,
  fetchScores,
  getGameByCode,
  subscribePoints
} from './lib/supabaseClient.js';
import {
  cacheGameMeta,
  cachePlayers,
  cachePoints,
  cacheScores,
  loadGameMeta,
  loadPlayers,
  loadPoints,
  loadScores
} from './lib/dbCache.js';
import { cancel as cancelMutation, enqueue, flush, getLength, subscribe as subscribeQueue } from './lib/offlineQueue.js';

const GAME_CODE = 'BELGFR';
const DEFAULT_PLAYERS = ['Eliott', 'Timéo', 'Lilouan'];

function isNetworkError(error) {
  if (!error) return false;
  return !navigator.onLine || error.message.toLowerCase().includes('fetch');
}

function createScoresMap(players, scoreRows) {
  const map = new Map();
  players.forEach((player) => {
    map.set(player.id, player.initial_score ?? 0);
  });

  if (Array.isArray(scoreRows)) {
    for (const row of scoreRows) {
      const playerId = row.player_id ?? row.id ?? row.playerId ?? row.players_id;
      if (!playerId) continue;
      const value =
        row.score ?? row.total ?? row.value ?? row.sum ?? row.current_score ?? map.get(playerId) ?? 0;
      map.set(playerId, value);
    }
  }

  return map;
}

function updateScore(map, playerId, delta) {
  const next = new Map(map);
  const current = next.get(playerId) ?? 0;
  next.set(playerId, current + delta);
  return next;
}

export default function App() {
  const [view, setView] = useState('scoreboard');
  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const [scores, setScores] = useState(new Map());
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [online, setOnline] = useState(() => navigator.onLine);
  const [queueLength, setQueueLength] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [commentState, setCommentState] = useState({ open: false, player: null, delta: 1, defaultComment: '' });
  const [updateReady, setUpdateReady] = useState(false);

  const playersById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const queueUnsub = subscribeQueue(async (event) => {
      if (event.type === 'queue-changed') {
        setQueueLength(event.length);
      } else if (event.type === 'sync-start') {
        setSyncing(true);
      } else if (event.type === 'sync-complete') {
        setSyncing(false);
        if (game?.id) {
          await loadRemoteData(game.id);
        }
      } else if (event.type === 'sync-error') {
        setSyncing(false);
        console.error('Erreur de synchronisation', event.error);
      }
    });

    getLength().then((length) => setQueueLength(length));

    return () => {
      queueUnsub();
    };
  }, [game?.id, loadRemoteData]);

  useEffect(() => {
    const handleUpdate = (event) => {
      setUpdateReady(true);
      window.__refreshSW = event.detail.refresh;
    };
    window.addEventListener('sw-update', handleUpdate);
    return () => window.removeEventListener('sw-update', handleUpdate);
  }, []);

  useEffect(() => {
    let cleanup;
    (async () => {
      try {
        cleanup = await bootstrap();
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      cleanup?.();
    };
  }, [bootstrap]);

  const loadRemoteData = useCallback(
    async (gameId) => {
      try {
        const [remotePlayers, remoteScores, remotePoints] = await Promise.all([
          fetchPlayers(gameId),
          fetchScores(gameId),
          fetchPoints(gameId)
        ]);

        setPlayers(remotePlayers);
        setScores(createScoresMap(remotePlayers, remoteScores));
        setPoints(remotePoints);

        await Promise.all([
          cachePlayers(gameId, remotePlayers),
          cacheScores(gameId, remoteScores),
          cachePoints(gameId, remotePoints)
        ]);
      } catch (err) {
        console.warn('Lecture distante impossible, chargement du cache', err);
        const [cachedPlayers, cachedScores, cachedPoints] = await Promise.all([
          loadPlayers(gameId),
          loadScores(gameId),
          loadPoints(gameId)
        ]);
        if (cachedPlayers) {
          setPlayers(cachedPlayers);
        }
        if (cachedScores && cachedPlayers) {
          setScores(createScoresMap(cachedPlayers, cachedScores));
        }
        if (cachedPoints) {
          setPoints(cachedPoints);
        }
      }
    },
    []
  );

  const bootstrap = useCallback(async () => {
    setError('');
    try {
      let gameRecord = null;
      if (navigator.onLine) {
        gameRecord = await getGameByCode(GAME_CODE);
        if (!gameRecord) {
          gameRecord = await createGameWithPlayers(GAME_CODE, DEFAULT_PLAYERS);
        }
        await cacheGameMeta(gameRecord);
      } else {
        gameRecord = (await loadGameMeta()) ?? null;
        if (!gameRecord) {
          throw new Error('Aucune donnée locale disponible. Connectez-vous une première fois.');
        }
      }

      setGame(gameRecord);
      await loadRemoteData(gameRecord.id);

      const unsubscribeRealtime = subscribePoints(gameRecord.id, (payload) => {
        if (!payload) return;
        setPoints((current) => {
          if (payload.eventType === 'INSERT') {
            const newPoint = payload.new;
            if (!newPoint || current.some((row) => row.id === newPoint.id)) {
              return current;
            }
            setScores((prev) => updateScore(prev, newPoint.player_id, newPoint.delta));
            return [newPoint, ...current];
          }
          if (payload.eventType === 'DELETE') {
            const oldPoint = payload.old;
            if (!oldPoint) return current;
            setScores((prev) => updateScore(prev, oldPoint.player_id, -oldPoint.delta));
            return current.filter((row) => row.id !== oldPoint.id);
          }
          if (payload.eventType === 'UPDATE') {
            const next = payload.new;
            const prevRow = payload.old;
            if (!next) return current;
            setScores((prev) => {
              let map = prev;
              if (prevRow) {
                map = updateScore(map, prevRow.player_id, -prevRow.delta);
              }
              return updateScore(map, next.player_id, next.delta);
            });
            return current.map((row) => (row.id === next.id ? next : row));
          }
          return current;
        });
      });

      flush();

      return () => {
        unsubscribeRealtime?.();
      };
    } catch (err) {
      console.error(err);
      setError(err.message ?? 'Erreur inconnue');
    }
  }, [loadRemoteData]);

  const handleAddPoint = useCallback(
    async ({ player, delta, comment }) => {
      if (!game) return;
      setError('');
      const normalizedComment =
        typeof comment === 'string' ? comment.trim() : comment == null ? null : String(comment).trim();
      const commentValue = normalizedComment ? normalizedComment : null;
      const payload = {
        id: `temp-${Date.now()}`,
        game_id: game.id,
        player_id: player.id,
        delta,
        comment: commentValue,
        created_at: new Date().toISOString(),
        pending: false
      };

      setPoints((current) => [payload, ...current]);
      setScores((prev) => updateScore(prev, player.id, delta));

      try {
        const inserted = await addPoint({
          gameId: game.id,
          playerId: player.id,
          delta,
          comment: commentValue
        });
        setPoints((current) => [inserted, ...current.filter((item) => item.id !== payload.id)]);
      } catch (err) {
        if (isNetworkError(err)) {
          const entry = await enqueue({
            type: 'insert',
            payload: { gameId: game.id, playerId: player.id, delta, comment: commentValue }
          });
          setPoints((current) =>
            current.map((item) =>
              item.id === payload.id ? { ...item, pending: true, queueId: entry.id } : item
            )
          );
        } else {
          setPoints((current) => current.filter((item) => item.id !== payload.id));
          setScores((prev) => updateScore(prev, player.id, -delta));
          setError(err.message ?? "Impossible d'ajouter le point");
        }
      }
    },
    [game]
  );

  const handleRemovePoint = useCallback(
    async (point) => {
      if (!game) return;
      setError('');
      setPoints((current) => current.filter((item) => item.id !== point.id));
      setScores((prev) => updateScore(prev, point.player_id, -point.delta));

      if (point.pending && point.queueId) {
        await cancelMutation(point.queueId);
        return;
      }

      try {
        await deletePoint(point.id);
      } catch (err) {
        if (isNetworkError(err)) {
          await enqueue({ type: 'delete', payload: { id: point.id } });
        } else {
          setPoints((current) => [point, ...current]);
          setScores((prev) => updateScore(prev, point.player_id, point.delta));
          setError(err.message ?? 'Impossible de supprimer le point');
        }
      }
    },
    [game]
  );

  const handleUndoLast = useCallback(
    (playerId) => {
      const lastPoint = points.find((point) => point.player_id === playerId);
      if (lastPoint) {
        handleRemovePoint(lastPoint);
      }
    },
    [points, handleRemovePoint]
  );

  const openCommentDialog = useCallback(({ player, delta, defaultComment }) => {
    setCommentState({ open: true, player, delta, defaultComment: defaultComment ?? '' });
  }, []);

  const handleCommentSubmit = useCallback(
    (text) => {
      const { player, delta } = commentState;
      setCommentState({ open: false, player: null, delta: 1, defaultComment: '' });
      if (player) {
        handleAddPoint({ player, delta, comment: text });
      }
    },
    [commentState, handleAddPoint]
  );

  const handleQuickAdd = useCallback(
    (player) => handleAddPoint({ player, delta: 1, comment: '' }),
    [handleAddPoint]
  );

  const handleQuickRemove = useCallback(
    (player) => handleAddPoint({ player, delta: -1, comment: '' }),
    [handleAddPoint]
  );

  const handleDeletePoint = useCallback(
    (point) => {
      handleRemovePoint(point);
    },
    [handleRemovePoint]
  );

  useEffect(() => {
    return () => {
      window.__refreshSW = undefined;
    };
  }, []);

  if (loading) {
    return (
      <main className="app">
        <p>Chargement…</p>
      </main>
    );
  }

  return (
    <main className="app">
      <header className="app__header">
        <h1 className="app__title">Diff Belgique vs France</h1>
        <nav className="nav-buttons" aria-label="Navigation principale">
          <button
            type="button"
            onClick={() => setView('scoreboard')}
            aria-pressed={view === 'scoreboard'}
          >
            Score
          </button>
          <button type="button" onClick={() => setView('history')} aria-pressed={view === 'history'}>
            Historique
          </button>
        </nav>
      </header>

      <StatusBanner online={online} syncing={syncing} queueLength={queueLength} />

      {error ? <p className="offline-badge">{error}</p> : null}

      {view === 'scoreboard' ? (
        <section className="scoreboard" aria-label="Tableau des scores">
          <div className="players-grid">
            {players.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                score={scores.get(player.id) ?? player.initial_score ?? 0}
                onQuickAdd={handleQuickAdd}
                onQuickRemove={handleQuickRemove}
                onRequestComment={openCommentDialog}
              />
            ))}
          </div>
        </section>
      ) : null}

      {view === 'history' ? (
        <section className="history" aria-label="Historique des points">
          <div className="history-controls">
            {players.map((player) => (
              <button type="button" key={player.id} onClick={() => handleUndoLast(player.id)}>
                Annuler le dernier point de {player.name}
              </button>
            ))}
          </div>
          <HistoryList points={points} playersById={playersById} onDelete={handleDeletePoint} />
        </section>
      ) : null}

      <CommentDialog
        open={commentState.open}
        title={commentState.delta > 0 ? 'Ajouter un point' : 'Retirer un point'}
        defaultValue={commentState.defaultComment}
        onCancel={() => setCommentState({ open: false, player: null, delta: 1, defaultComment: '' })}
        onSubmit={handleCommentSubmit}
      />

      <UpdateBanner
        visible={updateReady}
        onReload={() => {
          setUpdateReady(false);
          window.__refreshSW?.();
        }}
      />
    </main>
  );
}
