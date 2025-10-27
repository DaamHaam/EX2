import { useRef } from 'react';

const HOLD_DELAY = 600;

export function PlayerCard({ player, score, onQuickAdd, onQuickRemove, onRequestComment }) {
  const holdRef = useRef({ action: null, timer: null, triggered: false });

  const clearHold = () => {
    if (holdRef.current.timer) {
      clearTimeout(holdRef.current.timer);
      holdRef.current.timer = null;
    }
  };

  const startHold = (action, defaultComment = '') => (event) => {
    event.preventDefault();
    clearHold();
    holdRef.current = { action, timer: null, triggered: false };
    holdRef.current.timer = setTimeout(() => {
      holdRef.current.triggered = true;
      onRequestComment({
        player,
        delta: action === 'add' ? 1 : -1,
        defaultComment
      });
    }, HOLD_DELAY);
  };

  const endHold = (action) => (event) => {
    event.preventDefault();
    const { triggered } = holdRef.current;
    clearHold();
    if (!triggered) {
      if (action === 'add') {
        onQuickAdd(player);
      } else {
        onQuickRemove(player);
      }
    }
  };

  const cancelHold = () => {
    clearHold();
  };

  const handleKeyDown = (action, defaultComment) => (event) => {
    if (event.key === 'Enter' && event.altKey) {
      event.preventDefault();
      onRequestComment({
        player,
        delta: action === 'add' ? 1 : -1,
        defaultComment
      });
    }
  };

  return (
    <article className="player-card">
      <header className="player-card__header">
        <h2 className="player-card__name">{player.name}</h2>
        <span className="player-card__score" aria-live="polite">
          {score}
        </span>
      </header>
      <div className="player-card__actions">
        <button
          type="button"
          className="add"
          onPointerDown={startHold('add')}
          onPointerUp={endHold('add')}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          onKeyDown={handleKeyDown('add', '')}
          aria-label={`Ajouter un point pour ${player.name}`}
        >
          +1
        </button>
        <button
          type="button"
          className="remove"
          onPointerDown={startHold('remove', 'Correction')}
          onPointerUp={endHold('remove')}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          onKeyDown={handleKeyDown('remove', 'Correction')}
          aria-label={`Retirer un point à ${player.name}`}
        >
          -1
        </button>
      </div>
    </article>
  );
}
