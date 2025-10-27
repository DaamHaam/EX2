import { format } from '../utils/formatDate.js';

export function HistoryList({ points, playersById, onDelete }) {
  if (points.length === 0) {
    return <p>Pas encore d'historique.</p>;
  }

  return (
    <div className="history-list">
      {points.map((point) => {
        const player = playersById.get(point.player_id);
        return (
          <article className="history-item" key={point.id}>
            <div>
              <div className="history-item__meta">
                <span>{player?.name ?? 'Joueur'}</span>
                <span className="history-item__delta" aria-label="delta">
                  {point.delta > 0 ? `+${point.delta}` : point.delta}
                </span>
                <time dateTime={point.created_at}>{format(point.created_at)}</time>
                {point.pending ? <span className="offline-badge">En attente</span> : null}
              </div>
              {point.comment ? <p className="history-item__comment">{point.comment}</p> : null}
            </div>
            <button type="button" onClick={() => onDelete(point)} aria-label="Supprimer ce point">
              ⌫
            </button>
          </article>
        );
      })}
    </div>
  );
}
