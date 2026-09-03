import { useEffect, useState } from 'react';
import { IconDownload, IconExternalLink, IconFolder, FileKindIcon } from './icons';
import { getDocumentByToken } from '../lib/documents';
import { fileKind, formatDate, formatSize } from '../lib/format';
import type { DocumentItem } from '../types';

interface Props {
  token: string;
}

type Status = 'loading' | 'found' | 'not-found' | 'error';

export function SharedViewer({ token }: Props) {
  const [status, setStatus] = useState<Status>('loading');
  const [doc, setDoc] = useState<DocumentItem | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);

  // Busca metadado pelo token — o sharedFileUrl já vem no documento do Firestore
  useEffect(() => {
    let cancelled = false;
    getDocumentByToken(token)
      .then((found) => {
        if (cancelled) return;
        if (!found) { setStatus('not-found'); return; }
        setDoc(found);
        setStatus('found');
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[SharedViewer] erro ao buscar token:', err);
          setStatus('error');
        }
      });
    return () => { cancelled = true; };
  }, [token]);

  // Para arquivos de texto, busca o conteúdo via sharedFileUrl
  useEffect(() => {
    if (!doc || fileKind(doc.name) !== 'text' || !doc.sharedFileUrl) return;
    let cancelled = false;
    fetch(doc.sharedFileUrl)
      .then((r) => r.text())
      .then((t) => { if (!cancelled) setText(t); })
      .catch(() => { if (!cancelled) setTextError('Não foi possível carregar o conteúdo.'); });
    return () => { cancelled = true; };
  }, [doc]);

  // ── Estados de carregamento / erro / not-found ─────────────────

  if (status === 'loading') {
    return (
      <div className="shared-shell">
        <SharedHeader />
        <div className="shared-body"><p className="loading-text">Carregando…</p></div>
      </div>
    );
  }

  if (status === 'not-found') {
    return (
      <div className="shared-shell">
        <SharedHeader />
        <div className="shared-body">
          <div className="shared-not-found">
            <strong>Link inválido ou expirado</strong>
            <p>Este link de compartilhamento não existe ou foi revogado pelo dono.</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error' || !doc) {
    return (
      <div className="shared-shell">
        <SharedHeader />
        <div className="shared-body">
          <p className="error-banner">Ocorreu um erro ao carregar o arquivo. Tente novamente.</p>
        </div>
      </div>
    );
  }

  // ── Arquivo encontrado ─────────────────────────────────────────

  const kind = fileKind(doc.name);
  const canDownload = doc.sharedAllowDownload === true;
  // URL pré-salvo no Firestore pelo dono no momento do compartilhamento
  const fileUrl = doc.sharedFileUrl ?? null;

  if (!fileUrl) {
    // Documento compartilhado antes da implementação do sharedFileUrl — orientação ao visitante
    return (
      <div className="shared-shell">
        <SharedHeader />
        <div className="shared-body">
          <div className="shared-not-found">
            <strong>Link temporariamente indisponível</strong>
            <p>
              O dono do arquivo precisa regenerar o link de compartilhamento para que ele
              funcione corretamente.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shared-shell">
      <SharedHeader />
      <div className="shared-body">
        <div className="shared-card">
          {/* Cabeçalho do arquivo */}
          <div className="shared-file-header">
            <span className="doc-icon">
              <FileKindIcon kind={kind} size={22} />
            </span>
            <div className="shared-file-info">
              <span className="doc-name">{doc.name}</span>
              <span className="doc-meta">
                {doc.category} · {formatSize(doc.size)} · {formatDate(doc.uploadedAt)}
              </span>
            </div>
          </div>

          {/* Ações */}
          <div className="shared-actions">
            {kind === 'pdf' && (
              <a href={fileUrl} target="_blank" rel="noreferrer" className="btn btn-secondary">
                <IconExternalLink size={14} /> Nova aba
              </a>
            )}
            {canDownload ? (
              <a
                href={fileUrl}
                download={doc.name}
                className="btn btn-primary"
              >
                <IconDownload size={14} /> Baixar
              </a>
            ) : (
              <span className="shared-no-download">
                Download não permitido pelo compartilhador
              </span>
            )}
          </div>

          {/* Visualizador */}
          {kind === 'pdf' && (
            <iframe title={doc.name} src={fileUrl} className="viewer-frame shared-frame" />
          )}

          {kind === 'text' && (
            <pre className="viewer-text">
              {textError ?? text ?? 'Carregando…'}
            </pre>
          )}

          {(kind === 'word' || kind === 'excel' || kind === 'other') && (
            <div className="viewer-unsupported">
              <FileKindIcon kind={kind} size={40} />
              <p>Pré-visualização não disponível para este tipo de arquivo no navegador.</p>
              {canDownload ? (
                <a href={fileUrl} download={doc.name} className="btn btn-primary">
                  <IconDownload size={14} /> Baixar arquivo
                </a>
              ) : (
                <p className="shared-no-download">
                  Download não permitido pelo compartilhador.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SharedHeader() {
  return (
    <header className="shared-header">
      <div className="brand">
        <IconFolder size={18} />
        <span>Gestão Fiscal</span>
      </div>
      <span className="shared-badge">Arquivo compartilhado</span>
    </header>
  );
}
