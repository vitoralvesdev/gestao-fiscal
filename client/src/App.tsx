import { useEffect, useMemo, useState } from 'react';
import { IconGrid, IconPlus, IconSearch } from './components/icons';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { CategoryChips } from './components/CategoryChips';
import { DocumentsView } from './components/DocumentsView';
import { UploadModal } from './components/UploadModal';
import { EditModal } from './components/EditModal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ViewerModal } from './components/ViewerModal';
import { ShareModal } from './components/ShareModal';
import { SharedViewer } from './components/SharedViewer';
import { SignIn } from './components/SignIn';
import { signInWithGoogle, signOutUser, subscribeToAuth, type User } from './lib/auth';
import {
  deleteDocument,
  downloadDocument,
  subscribeToDocuments,
  updateDocument,
  uploadManyDocuments,
} from './lib/documents';
import type { CategoryCount, DocumentItem } from './types';

type AuthStatus = 'loading' | 'signed-out' | 'signed-in';
type SearchField = 'name' | 'category';

const PAGE_SIZE = 20;

/** Extrai o token de compartilhamento da URL, se estiver em /share/:token */
function getShareToken(): string | null {
  const match = window.location.pathname.match(/^\/share\/([^/]+)$/);
  return match ? match[1] : null;
}

/** Ponto de entrada — roteia entre app autenticado e viewer público */
export default function App() {
  const shareToken = getShareToken();
  if (shareToken) return <SharedViewer token={shareToken} />;
  return <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchField, setSearchField] = useState<SearchField>('name');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewerDoc, setViewerDoc] = useState<DocumentItem | null>(null);
  const [editDoc, setEditDoc] = useState<DocumentItem | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<DocumentItem | null>(null);
  const [shareDoc, setShareDoc] = useState<DocumentItem | null>(null);

  useEffect(() => {
    return subscribeToAuth((u) => {
      setUser(u);
      setAuthStatus(u ? 'signed-in' : 'signed-out');
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setDocuments([]);
      return;
    }
    setDocsLoading(true);
    setError(null);
    return subscribeToDocuments(
      user.uid,
      (docs) => {
        setDocuments(docs);
        setDocsLoading(false);
      },
      (err) => {
        setError(err.message);
        setDocsLoading(false);
      }
    );
  }, [user]);

  const categories = useMemo<CategoryCount[]>(() => {
    const counts = new Map<string, number>();
    for (const doc of documents) counts.set(doc.category, (counts.get(doc.category) || 0) + 1);
    return [...counts.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => a.category.localeCompare(b.category, 'pt-BR'));
  }, [documents]);

  const totalCount = documents.length;
  const existingCategories = useMemo(() => categories.map((c) => c.category), [categories]);

  // Documentos filtrados (sem paginação) — usados para contagem e paginação
  const filteredDocuments = useMemo(() => {
    const term = search.toLowerCase();
    return documents
      .filter((d) => !selectedCategory || d.category === selectedCategory)
      .filter((d) => {
        if (!term) return true;
        if (searchField === 'category') return d.category.toLowerCase().includes(term);
        return d.name.toLowerCase().includes(term);
      });
  }, [documents, selectedCategory, search, searchField]);

  // Reset página ao mudar qualquer filtro
  useEffect(() => { setPage(1); }, [selectedCategory, search, searchField]);

  // Fatia da página atual
  const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / PAGE_SIZE));
  const visibleDocuments = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredDocuments.slice(start, start + PAGE_SIZE);
  }, [filteredDocuments, page]);

  function namesInCategory(category: string, excludeId?: string): string[] {
    return documents
      .filter((d) => d.category === category && d.id !== excludeId)
      .map((d) => d.name);
  }

  /** Atualiza um documento na lista local sem precisar esperar o Firestore re-emitir. */
  function updateDocInList(updated: DocumentItem) {
    setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    setShareDoc((prev) => (prev?.id === updated.id ? updated : prev));
  }

  // Documentos com link ativo — alimenta o painel da TopBar
  const sharedDocs = useMemo(
    () => documents.filter((d) => !!d.sharedToken),
    [documents]
  );

  if (authStatus === 'loading') return null;
  if (!user) return <SignIn onSignIn={signInWithGoogle} />;

  return (
    <div className="app-shell">
      <TopBar
        user={user}
        sharedDocs={sharedDocs}
        onSignOut={signOutUser}
        onUpdateDoc={updateDocInList}
      />

      <div className="app-body">
        <aside className="sidebar">
          <Sidebar
            categories={categories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
            totalCount={totalCount}
          />
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

            <div className="search-row">
              <div className="search-box">
                <IconSearch size={16} />
                <input
                  className="search-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchField === 'name' ? 'Buscar por nome…' : 'Buscar por categoria…'}
                />
              </div>
              <div className="search-field-toggle">
                <button
                  className={`search-field-btn${searchField === 'name' ? ' active' : ''}`}
                  onClick={() => setSearchField('name')}
                >
                  Nome
                </button>
                <button
                  className={`search-field-btn${searchField === 'category' ? ' active' : ''}`}
                  onClick={() => setSearchField('category')}
                >
                  Categoria
                </button>
              </div>
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
            {docsLoading ? (
              <p className="loading-text">Carregando…</p>
            ) : filteredDocuments.length === 0 ? (
              <div className="empty-state">
                {search || selectedCategory ? (
                  <>
                    <strong>Nenhum resultado encontrado</strong>
                    <p>Tente ajustar os filtros ou limpar a busca.</p>
                  </>
                ) : (
                  <>
                    <strong>Nenhum arquivo por aqui ainda</strong>
                    <p>Clique em "Novo arquivo" para começar a organizar seus documentos.</p>
                  </>
                )}
              </div>
            ) : (
              <>
                <DocumentsView
                  docs={visibleDocuments}
                  onOpen={setViewerDoc}
                  onEdit={setEditDoc}
                  onDelete={setDeleteDoc}
                  onShare={setShareDoc}
                  onDownload={(d) => downloadDocument(d).catch((err) => setError(err.message))}
                />

                {totalPages > 1 && (
                  <div className="pagination">
                    <button
                      className="btn btn-secondary pagination-btn"
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                      aria-label="Primeira página"
                    >«</button>
                    <button
                      className="btn btn-secondary pagination-btn"
                      onClick={() => setPage((p) => p - 1)}
                      disabled={page === 1}
                      aria-label="Página anterior"
                    >‹</button>
                    <span className="pagination-info">
                      {page} / {totalPages}
                      <span className="pagination-total">
                        ({filteredDocuments.length} arquivo{filteredDocuments.length !== 1 ? 's' : ''})
                      </span>
                    </span>
                    <button
                      className="btn btn-secondary pagination-btn"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page === totalPages}
                      aria-label="Próxima página"
                    >›</button>
                    <button
                      className="btn btn-secondary pagination-btn"
                      onClick={() => setPage(totalPages)}
                      disabled={page === totalPages}
                      aria-label="Última página"
                    >»</button>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {uploadOpen && user && (
        <UploadModal
          existingCategories={existingCategories}
          onClose={() => setUploadOpen(false)}
          onUploadMany={(items, onProgress) =>
            uploadManyDocuments(user.uid, items, onProgress)
          }
        />
      )}

      {editDoc && user && (
        <EditModal
          doc={editDoc}
          existingCategories={existingCategories}
          onClose={() => setEditDoc(null)}
          onSave={(changes) =>
            updateDocument(
              user.uid,
              editDoc,
              changes,
              namesInCategory(changes.category, editDoc.id)
            )
          }
        />
      )}

      {deleteDoc && user && (
        <ConfirmDialog
          title="Excluir arquivo"
          message={`Tem certeza que deseja excluir "${deleteDoc.name}"? Essa ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          onClose={() => setDeleteDoc(null)}
          onConfirm={() => deleteDocument(user.uid, deleteDoc)}
        />
      )}

      {viewerDoc && <ViewerModal doc={viewerDoc} onClose={() => setViewerDoc(null)} />}

      {shareDoc && user && (
        <ShareModal
          doc={shareDoc}
          uid={user.uid}
          onClose={() => setShareDoc(null)}
          onUpdate={updateDocInList}
        />
      )}
    </div>
  );
}
