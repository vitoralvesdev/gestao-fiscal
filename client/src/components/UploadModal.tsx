import { useRef, useState } from 'react';
import { Modal } from './Modal';
import { IconUploadCloud, IconTrash, IconFolder } from './icons';
import { suggestCategory, suggestCategoryFromPath } from '../lib/category';
import { ALLOWED_EXTENSIONS } from '../lib/format';
import type { UploadItem, UploadProgress } from '../lib/documents';

interface Props {
  existingCategories: string[];
  onClose: () => void;
  /** Recebe a lista final de itens já com categorias confirmadas + callback de progresso */
  onUploadMany: (items: UploadItem[], onProgress: (p: UploadProgress) => void) => Promise<UploadProgress>;
}

const ACCEPT = ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(',');

interface QueueItem {
  id: string;          // key estável para o React
  file: File;
  category: string;
  relativePath: string; // "" para arquivos avulsos
}

let _idCounter = 0;
function nextId() { return String(++_idCounter); }

/** Verifica se a extensão do arquivo é suportada. */
function isAllowed(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return ALLOWED_EXTENSIONS.includes(ext);
}

export function UploadModal({ existingCategories, onClose, onUploadMany }: Props) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [done, setDone] = useState(false);
  const [skipped, setSkipped] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // ── Adicionar arquivos à fila ──────────────────────────────────

  function addFiles(files: File[], fromFolder = false) {
    const newItems: QueueItem[] = [];
    const newSkipped: string[] = [];

    for (const file of files) {
      if (!isAllowed(file.name)) {
        newSkipped.push(file.name);
        continue;
      }
      const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? '';
      const category =
        fromFolder && relativePath
          ? suggestCategoryFromPath(relativePath)
          : suggestCategory(file.name);

      newItems.push({ id: nextId(), file, category, relativePath });
    }

    setQueue((prev) => {
      // Evita duplicatas pelo nome + tamanho
      const existing = new Set(prev.map((q) => `${q.file.name}|${q.file.size}`));
      return [...prev, ...newItems.filter((i) => !existing.has(`${i.file.name}|${i.file.size}`))];
    });

    if (newSkipped.length) {
      setSkipped((prev) => [...prev, ...newSkipped]);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const isFolder = !!(files[0] as File & { webkitRelativePath?: string })?.webkitRelativePath;
    addFiles(files, isFolder);
    e.target.value = ''; // reset para poder escolher de novo
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    addFiles(Array.from(e.dataTransfer.files));
  }

  // ── Editar categoria de um item da fila ───────────────────────

  function updateCategory(id: string, category: string) {
    setQueue((prev) => prev.map((item) => item.id === id ? { ...item, category } : item));
  }

  function removeItem(id: string) {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  }

  // ── Enviar ────────────────────────────────────────────────────

  async function handleSubmit() {
    if (queue.length === 0) return;
    // Mostra a tela de progresso imediatamente
    setProgress({ total: queue.length, done: 0, current: null, errors: [] });
    const result = await onUploadMany(
      queue.map(({ file, category }) => ({ file, category: category.trim() || 'Outros' })),
      (p) => setProgress(p)
    );
    setProgress(result);
    setDone(true);
  }

  const isUploading = progress !== null && !done;
  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;

  // ── Após concluir ─────────────────────────────────────────────

  if (done && progress) {
    const hasErrors = progress.errors.length > 0;
    return (
      <Modal title="Upload concluído" onClose={onClose}>
        <div className="upload-done">
          <p>
            <strong>{progress.done - progress.errors.length}</strong> de{' '}
            <strong>{progress.total}</strong> arquivo(s) enviado(s) com sucesso.
          </p>
          {hasErrors && (
            <div className="upload-errors">
              <p className="upload-errors-title">Falhas ({progress.errors.length}):</p>
              <ul>
                {progress.errors.map((e, i) => (
                  <li key={i}>
                    <strong>{e.name}</strong>: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button className="btn btn-primary btn-block" onClick={onClose}>
            Fechar
          </button>
        </div>
      </Modal>
    );
  }

  // ── Em progresso ──────────────────────────────────────────────

  if (isUploading) {
    return (
      <Modal title="Enviando arquivos…" onClose={() => {}}>
        <div className="upload-progress-panel">
          <div className="upload-progress-bar-track">
            <div className="upload-progress-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="upload-progress-label">
            {progress!.done}/{progress!.total} — {pct}%
          </p>
          {progress!.current && (
            <p className="upload-progress-current">Enviando: {progress!.current}</p>
          )}
        </div>
      </Modal>
    );
  }

  // ── Formulário ────────────────────────────────────────────────

  return (
    <Modal title="Adicionar arquivos" onClose={onClose} wide>
      {/* Dropzone + botões de seleção */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`dropzone${dragOver ? ' drag-over' : ''}`}
      >
        <IconUploadCloud size={28} />
        <strong>Arraste arquivos ou uma pasta aqui</strong>
        <p>ou escolha abaixo</p>
        <div className="upload-btn-row">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            Selecionar arquivos
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => folderInputRef.current?.click()}
          >
            <IconFolder size={15} /> Selecionar pasta
          </button>
        </div>
        <p>PDF, Word, Excel ou TXT</p>

        {/* input de arquivos avulsos */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT}
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />
        {/* input de pasta inteira */}
        <input
          ref={folderInputRef}
          type="file"
          multiple
          accept={ACCEPT}
          // @ts-expect-error — atributos não-padrão suportados por navegadores Chromium
          webkitdirectory=""
          directory=""
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />
      </div>

      {/* Arquivos ignorados */}
      {skipped.length > 0 && (
        <p className="upload-skipped">
          {skipped.length} arquivo(s) ignorado(s) por tipo não suportado:{' '}
          {skipped.slice(0, 3).join(', ')}
          {skipped.length > 3 && ` e mais ${skipped.length - 3}…`}
        </p>
      )}

      {/* Fila de arquivos */}
      {queue.length > 0 && (
        <div className="upload-queue">
          <div className="upload-queue-header">
            <span>{queue.length} arquivo(s) na fila</span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setQueue([])}
            >
              Limpar tudo
            </button>
          </div>

          <div className="upload-queue-list">
            {queue.map((item) => (
              <div key={item.id} className="upload-queue-item">
                <div className="upload-queue-item-name" title={item.file.name}>
                  {item.file.name}
                  {item.relativePath && (
                    <span className="upload-queue-item-path">
                      {item.relativePath.split('/').slice(0, -1).join('/')}
                    </span>
                  )}
                </div>
                <input
                  className="upload-queue-item-cat"
                  value={item.category}
                  onChange={(e) => updateCategory(item.id, e.target.value)}
                  list="category-options"
                  placeholder="Categoria"
                  aria-label={`Categoria de ${item.file.name}`}
                />
                <button
                  type="button"
                  className="icon-btn danger"
                  title="Remover"
                  onClick={() => removeItem(item.id)}
                >
                  <IconTrash size={15} />
                </button>
              </div>
            ))}
          </div>

          <datalist id="category-options">
            {existingCategories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={queue.length === 0}
        className="btn btn-primary btn-block"
      >
        {queue.length === 0
          ? 'Adicione arquivos acima'
          : `Enviar ${queue.length} arquivo(s)`}
      </button>
    </Modal>
  );
}
