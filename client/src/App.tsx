import { useEffect, useMemo, useState } from 'react';
import { IconFolder, IconGrid, IconLogout, IconPlus, IconSearch } from './components/icons';
import { Sidebar } from './components/Sidebar';
import { CategoryChips } from './components/CategoryChips';
import { DocumentRow } from './components/DocumentRow';
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
  uploadDocument,
} from './lib/documents';
import type { CategoryCount, DocumentItem } from './types';

type AuthStatus = 'loading' | 'signed-out' | 'signed-in';

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

  const visibleDocuments = useMemo(() => {
    return documents
      .filter((d) => !selectedCategory || d.category === selectedCategory)
      .filter((d) => !search || d.name.toLowerCase().includes(search.toLowerCase()));
  }, [documents, selectedCategory, search]);

  function namesInCategory(category: string, excludeId?: string): string[] {
    return documents
      .filter((d) => d.category === category && d.id !== excludeId)
      .map((d) => d.name);
  }

  /** Atualiza um documento na lista local sem precisar esperar o Firestore re-emitir. */
  function updateDocInList(updated: DocumentItem) {
    setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    // Reflete no modal de share se ainda estiver aberto
    setShareDoc((prev) => (prev?.id === updated.id ? updated : prev));
  }

  if (authStatus === 'loading') return null;
  if (authStatus === 'signed-out') return <SignIn onSignIn={signInWithGoogle} />;

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
          <button className="btn btn-secondary btn-block" onClick={() => signOutUser()}>
            <IconLogout size={16} /> Sair ({user?.displayName ?? user?.email})
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
          {docsLoading ? (
            <p className="loading-text">Carregando…</p>
          ) : visibleDocuments.length === 0 ? (
            <div className="empty-state">
              <strong>Nenhum arquivo por aqui ainda</strong>
              <p>Clique em "Novo arquivo" para começar a organizar seus documentos.</p>
            </div>
          ) : (
            <div className="doc-list">
              {visibleDocuments.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  onOpen={setViewerDoc}
                  onEdit={setEditDoc}
                  onDelete={setDeleteDoc}
                  onShare={setShareDoc}
                  onDownload={(d) => downloadDocument(d).catch((err) => setError(err.message))}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {uploadOpen && user && (
        <UploadModal
          existingCategories={existingCategories}
          onClose={() => setUploadOpen(false)}
          onUpload={(file, category) =>
            uploadDocument(user.uid, file, category, namesInCategory(category))
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
