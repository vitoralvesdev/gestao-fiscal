import { useState } from 'react';
import { Modal } from './Modal';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function ConfirmDialog({ title, message, confirmLabel = 'Confirmar', onClose, onConfirm }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao executar ação');
      setSubmitting(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <p>{message}</p>
      {error && <p className="error-banner">{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>
          Cancelar
        </button>
        <button onClick={handleConfirm} disabled={submitting} className="btn btn-danger" style={{ flex: 1 }}>
          {submitting ? 'Excluindo…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
