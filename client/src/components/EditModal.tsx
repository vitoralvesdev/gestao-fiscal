import { useState } from 'react';
import { Modal } from './Modal';
import type { DocumentItem } from '../types';

interface Props {
  doc: DocumentItem;
  existingCategories: string[];
  onClose: () => void;
  onSave: (changes: { name: string; category: string }) => Promise<void>;
}

export function EditModal({ doc, existingCategories, onClose, onSave }: Props) {
  const [name, setName] = useState(doc.name);
  const [category, setCategory] = useState(doc.category);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name.trim() || !category.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), category: category.trim() });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Editar arquivo" onClose={onClose}>
      <div className="field">
        <label>Nome do arquivo</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>Categoria</label>
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          list="edit-category-options"
        />
        <datalist id="edit-category-options">
          {existingCategories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      {error && <p className="error-banner">{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={!name.trim() || !category.trim() || submitting}
        className="btn btn-primary btn-block"
      >
        {submitting ? 'Salvando…' : 'Salvar alterações'}
      </button>
    </Modal>
  );
}
