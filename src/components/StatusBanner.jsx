export function StatusBanner({ online, syncing, queueLength }) {
  let status = 'online';
  let message = 'Connecté';

  if (!online) {
    status = 'offline';
    message = 'Hors ligne : les actions sont enregistrées localement.';
  } else if (syncing) {
    status = 'syncing';
    message = 'Synchronisation en cours…';
  }

  return (
    <section className="status-banner" data-status={status} aria-live="polite">
      <span>{message}</span>
      {queueLength > 0 ? <span className="queue-indicator">Actions en attente : {queueLength}</span> : null}
    </section>
  );
}
