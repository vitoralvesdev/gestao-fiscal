import { useEffect, useMemo, useState } from 'react';
import { IconFolder, IconGrid, IconPlus, IconSearch } from './components/icons';
import { Sidebar } from './components/Sidebar';
import { CategoryChips } from './components/CategoryChips';
import { DocumentRow } from './components/DocumentRow';
import { UploadModal } from './components/UploadModal';
import { EditModal } from './components/EditModal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ViewerModal } from './components/ViewerModal';
import { FolderSetup } from './components/FolderSetup';
import {
  deleteFile,
  ensurePermission,
  getStoredRootHandle,
  isSupported,
  listCategories,
  listDocuments,
  pickRootDirectory,
  readFile,
  renameOrMoveFile,
  uploadFile,
} from './lib/fsAccess';
import type { CategoryCount, DocumentItem } from './types';

type RootStatus = 'loading' | 'pick' | 'reconnect' | 'unsupported' | 'ready';

export default function App() {
  const [rootStatus, setRootStatus] = useState<RootStatus>('loading');
  const [root, setRoot] = useState<FileSystemDirectoryHandle | null>(null);
  const [pendingHandle, setPendingHandle] = useState<FileSystemDirectoryHandle | null>(null);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewerDoc, setViewerDoc] = useState<DocumentItem | null>(null);
  const [editDoc, setEditDoc] = useState<DocumentItem | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<DocumentItem | null>(null);

  useEffect(() => {
    if (!isSupported()) {
      setRootStatus('unsupported');
      return;
    }
    (async () => {
      const handle = await getStoredRootHandle();
      if (!handle) {
        setRootStatus('pick');
        return;
      }
      const granted = (await handle.queryPermission({ mode: 'readwrite' })) === 'granted';
      if (granted) {
        setRoot(handle);
        setRootStatus('ready');
      } else {
        setPendingHandle(handle);
        setRootStatus('reconnect');
      }
    })();
  }, []);

  async function refresh(activeRoot: FileSystemDirectoryHandle) {
    setLoading(true);
    setError(null);
    try {
      const [docs, cats] = await Promise.all([
        listDocuments(activeRoot, selectedCategory ?? undefined),
        listCategories(activeRoot),
      ]);
      const filtered = search
        ? docs.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()))
        : docs;
      setDocuments(filtered);
      setCategories(cats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao ler a pasta');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!root) return;
    const timeout = setTimeout(() => refresh(root), search ? 250 : 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, selectedCategory, search]);

  const totalCount = useMemo(() => categories.reduce((sum, c) => sum + c.count, 0), [categories]);
  const existingCategories = useMemo(() => categories.map((c) => c.category), [categories]);

  async function handlePickFolder() {
    const handle = await pickRootDirectory();
    setRoot(handle);
    setRootStatus('ready');
    setSelectedCategory(null);
  }

  async function handleReconnect() {
    if (!pendingHandle) return;
    const granted = await ensurePermission(pendingHandle);
    if (!granted) throw new Error('Permissão negada. Tente novamente.');
    setRoot(pendingHandle);
    setRootStatus('ready');
  }

  async function handleDownload(doc: DocumentItem) {
    if (!root) return;
    const file = await readFile(root, doc.category, doc.name);
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (rootStatus === 'loading') return null;
  if (rootStatus === 'unsupported') return <FolderSetup mode="unsupported" onPick={async () => {}} />;
  if (rootStatus === 'pick') return <FolderSetup mode="pick" onPick={handlePickFolder} />;
  if (rootStatus === 'reconnect')
    return <FolderSetup mode="reconnect" folderName={pendingHandle?.name} onPick={handleReconnect} />;
  if (!root) return null;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <IconFolder size={20} />
          <span>Gestão Fiscal</span>
        </div>
        <Sidebar
          categories={categories}
          selected={selectedCategory}
          onSelect={setSelectedCategory}
          totalCount={totalCount}
        />
        <div className="sidebar-footer">
          <button className="btn btn-secondary btn-block" onClick={handlePickFolder}>
            Trocar pasta
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="header">
          <div className="header-row">
            <div className="mobile-brand">
              <IconGrid size={18} />
              <span>Gestão Fiscal</span>
            </div>
            <h1 className="header-title">{selectedCategory ?? 'Todos os arquivos'}</h1>
            <button className="btn btn-primary btn-ml-auto" onClick={() => setUploadOpen(true)}>
              <IconPlus size={16} /> Novo arquivo
            </button>
          </div>

          <div className="search-box">
            <IconSearch size={16} />
            <input
              className="search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome do arquivo…"
            />
          </div>

          <CategoryChips
            categories={categories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
            totalCount={totalCount}
          />
        </header>

        <main className="content">
          {error && <p className="error-banner">{error}</p>}
          {loading ? (
            <p className="loading-text">Carregando…</p>
          ) : documents.length === 0 ? (
            <div className="empty-state">
              <strong>Nenhum arquivo por aqui ainda</strong>
              <p>Clique em "Novo arquivo" para começar a organizar seus documentos.</p>
            </div>
          ) : (
            <div className="doc-list">
              {documents.map((doc) => (
                <DocumentRow
                  key={`${doc.category}/${doc.name}`}
                  doc={doc}
                  onOpen={setViewerDoc}
                  onEdit={setEditDoc}
                  onDelete={setDeleteDoc}
                  onDownload={handleDownload}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {uploadOpen && (
        <UploadModal
          existingCategories={existingCategories}
          onClose={() => setUploadOpen(false)}
          onUpload={async (file, category) => {
            await uploadFile(root, file, category);
            await refresh(root);
          }}
        />
      )}

      {editDoc && (
        <EditModal
          doc={editDoc}
          existingCategories={existingCategories}
          onClose={() => setEditDoc(null)}
          onSave={async (changes) => {
            await renameOrMoveFile(root, { category: editDoc.category, name: editDoc.name }, changes);
            await refresh(root);
          }}
        />
      )}

      {deleteDoc && (
        <ConfirmDialog
          title="Excluir arquivo"
          message={`Tem certeza que deseja excluir "${deleteDoc.name}"? Essa ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          onClose={() => setDeleteDoc(null)}
          onConfirm={async () => {
            await deleteFile(root, deleteDoc.category, deleteDoc.name);
            await refresh(root);
          }}
        />
      )}

      {viewerDoc && <ViewerModal root={root} doc={viewerDoc} onClose={() => setViewerDoc(null)} />}
    </div>
  );
}
