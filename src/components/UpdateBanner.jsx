export function UpdateBanner({ visible, onReload }) {
  if (!visible) return null;

  return (
    <div className="update-banner" role="status">
      <span>Nouvelle version disponible</span>
      <button type="button" onClick={onReload}>
        Actualiser
      </button>
    </div>
  );
}
