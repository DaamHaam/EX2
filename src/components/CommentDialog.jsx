import { useEffect, useRef, useState } from 'react';

export function CommentDialog({ open, title, defaultValue, onCancel, onSubmit }) {
  const [value, setValue] = useState(defaultValue ?? '');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (open) {
      setValue(defaultValue ?? '');
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    }
  }, [open, defaultValue]);

  if (!open) {
    return null;
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <form
        className="comment-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(value.trim());
        }}
      >
        <h2>{title}</h2>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Commentaire (optionnel)"
        />
        <div className="comment-dialog__actions">
          <button type="button" onClick={onCancel}>
            Annuler
          </button>
          <button type="submit">Valider</button>
        </div>
      </form>
    </div>
  );
}
