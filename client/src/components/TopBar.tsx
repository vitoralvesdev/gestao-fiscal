import { useEffect, useRef, useState } from 'react';
import { IconShare, IconLogout, IconFolder, IconExternalLink } from './icons';
import { unshareDocument } from '../lib/documents';
import type { DocumentItem } from '../types';
import type { User } from '../lib/auth';

interface Props {
  user: User;
  sharedDocs: DocumentItem[];
  onSignOut: () => void;
  onUpdateDoc: (updated: DocumentItem) => void;
}

export function TopBar({ user, sharedDocs, onSignOut, onUpdateDoc }: Props) {
  const [shareOpen, setShareOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Fecha o painel ao clicar fora
  useEffect(() => {
    if (!shareOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setShareOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [shareOpen]);

  const sharedCount = sharedDocs.length;

  return (
    <header className="topbar">
      {/* Marca — visível só em desktop (mobile usa a marca dentro do header de conteúdo) */}
      <div className="topbar-brand">
        <IconFolder size={18} />
        <span>Gestão Fiscal</span>
      </div>

      <div className="topbar-actions">
        {/* Botão de links compartilhados */}
        <div className="topbar-popover-anchor">
          <button
            ref={btnRef}
            className={`topbar-icon-btn${shareOpen ? ' active' : ''}`}
            onClick={() => setShareOpen((v) => !v)}
            aria-label="Links compartilhados"
            title="Links compartilhados"
          >
            <IconShare size={18} />
            {sharedCount > 0 && (
              <span className="topbar-badge">{sharedCount}</span>
            )}
          </button>

          {shareOpen && (
            <div ref={panelRef} className="topbar-panel">
              <div className="topbar-panel-header">
                <span>Links compartilhados</span>
                <span className="topbar-panel-count">{sharedCount}</span>
              </div>

              {sharedCount === 0 ? (
                <div className="topbar-panel-empty">
                  <IconShare size={28} />
                  <p>Nenhum arquivo compartilhado ainda.</p>
                </div>
              ) : (
                <ul className="topbar-panel-list">
                  {sharedDocs.map((doc) => (
                    <SharedDocItem
                      key={doc.id}
                      doc={doc}
                      onUpdate={onUpdateDoc}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <span className="topbar-divider" />

        {/* Avatar + nome + logout */}
        <div className="topbar-user">
          <Avatar user={user} />
          <span className="topbar-username">{user.displayName ?? user.email}</span>
        </div>
        <button
          className="topbar-icon-btn"
          onClick={onSignOut}
          title="Sair"
          aria-label="Sair"
        >
          <IconLogout size={17} />
        </button>
      </div>
    </header>
  );
}

// ── Item de documento compartilhado no painel ─────────────────────

interface SharedDocItemProps {
  doc: DocumentItem;
  onUpdate: (updated: DocumentItem) => void;
}

function SharedDocItem({ doc, onUpdate }: SharedDocItemProps) {
  const [revoking, setRevoking] = useState(false);

  async function handleRevoke() {
    setRevoking(true);
    try {
      // Precisamos do uid — ele está no storagePath: "users/{uid}/..."
      const uid = doc.storagePath.split('/')[1];
      await unshareDocument(uid, doc);
      onUpdate({ ...doc, sharedToken: undefined, sharedAllowDownload: undefined, sharedFileUrl: undefined });
    } finally {
      setRevoking(false);
    }
  }

  const shareUrl = doc.sharedToken
    ? `${window.location.origin}/share/${doc.sharedToken}`
    : null;

  return (
    <li className="topbar-panel-item">
      <div className="topbar-panel-item-info">
        <span className="topbar-panel-item-name" title={doc.name}>{doc.name}</span>
        <span className="topbar-panel-item-cat">{doc.category}</span>
      </div>
      <div className="topbar-panel-item-actions">
        {shareUrl && (
          <a
            href={shareUrl}
            target="_blank"
            rel="noreferrer"
            className="topbar-icon-btn small"
            title="Abrir link"
          >
            <IconExternalLink size={14} />
          </a>
        )}
        {/* Toggle switch para revogar */}
        <label className="topbar-revoke-toggle" title={revoking ? 'Revogando…' : 'Revogar link'}>
          <input
            type="checkbox"
            checked={true}
            onChange={handleRevoke}
            disabled={revoking}
          />
          <span className={`topbar-toggle-track${revoking ? ' revoking' : ''}`}>
            <span className="topbar-toggle-thumb" />
          </span>
        </label>
      </div>
    </li>
  );
}

// ── Avatar com inicial ────────────────────────────────────────────

function Avatar({ user }: { user: User }) {
  const [imgError, setImgError] = useState(false);
  const initial = (user.displayName ?? user.email ?? '?')[0].toUpperCase();

  if (user.photoURL && !imgError) {
    return (
      <img
        src={user.photoURL}
        alt={initial}
        className="topbar-avatar"
        onError={() => setImgError(true)}
        referrerPolicy="no-referrer"
      />
    );
  }
  return <span className="topbar-avatar topbar-avatar-initial">{initial}</span>;
}
