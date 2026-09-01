import { useRef, useState } from 'react';
import { Modal } from './Modal';
import { IconUploadCloud } from './icons';
import { suggestCategory } from '../lib/category';
import { ALLOWED_EXTENSIONS } from '../lib/fsAccess';

interface Props {
  existingCategories: string[];
  onClose: () => void;
  onUpload: (file: File, category: string) => Promise<void>;
}

const ACCEPT = ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(',');

export function UploadModal({ existingCategories, onClose, onUpload }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File | undefined | null) {
    if (!f) return;
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      setError('Tipo de arquivo não suportado. Use PDF, Word, Excel ou TXT.');
      return;
    }
    setFile(f);
    setCategory(suggestCategory(f.name));
    setError(null);
  }

  async function handleSubmit() {
    if (!file || !category.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onUpload(file, category.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar arquivo');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Adicionar arquivo" onClose={onClose}>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pickFile(e.dataTransfer.files?.[0]);
        }}
        className={`dropzone${dragOver ? ' drag-over' : ''}`}
      >
        <IconUploadCloud size={28} />
        {file ? (
          <p className="file-picked">{file.name}</p>
        ) : (
          <>
            <strong>Clique ou arraste um arquivo aqui</strong>
            <p>PDF, Word, Excel ou TXT</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          style={{ display: 'none' }}
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
      </div>

      {file && (
        <div className="field">
          <label>Categoria</label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            list="category-options"
            placeholder="Ex: Boleto"
          />
          <datalist id="category-options">
            {existingCategories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <p className="field-hint">
            Sugerida a partir do nome do arquivo — pode editar antes de salvar. Vira uma pasta
            dentro da sua pasta de arquivos.
          </p>
        </div>
      )}

      {error && <p className="error-banner">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={!file || !category.trim() || submitting}
        className="btn btn-primary btn-block"
      >
        {submitting ? 'Enviando…' : 'Salvar arquivo'}
      </button>
    </Modal>
  );
}
