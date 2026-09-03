import { useEffect, useState } from 'react';
import { IconDownload, IconExternalLink, IconFolder, FileKindIcon } from './icons';
import { getDocumentByToken, getDocumentUrl, downloadDocument } from '../lib/documents';
import { fileKind, formatDate, formatSize } from '../lib/format';
import type { DocumentItem } from '../types';

interface Props {
  token: string;
}

type Status = 'loading' | 'found' | 'not-found' | 'error';

export function SharedViewer({ token }: Props) {
  const [status, setStatus] = useState<Status>('loading');
  const [doc, setDoc] = useState<DocumentItem | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  // 1. Busca metadado pelo token
  useEffect(() => {
    let cancelled = false;
    getDocumentByToken(token)
      .then((found) => {
        if (cancelled) return;
        if (!found) { setStatus('not-found'); return; }
        setDoc(found);
        setStatus('found');
      })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [token]);

  // 2. Busca URL assim que o metadado chegar
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    const kind = fileKind(doc.name);
    getDocumentUrl(doc)
      .then(async (downloadUrl) => {
        if (cancelled) return;
        setUrl(downloadUrl);
        if (kind === 'text') {
          const res = await fetch(downloadUrl);
          if (!cancelled) setText(await res.text());
        }
      })
      .catch(() => { if (!cancelled) setFileError('Não foi possível carregar o arquivo.'); });
    return () => { cancelled = true; };
  }, [doc]);

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

  const kind = fileKind(doc.name);
  const canDownload = doc.sharedAllowDownload === true;

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

          {/* Ações — condicionais pela permissão de download */}
          {url && !fileError && (
            <div className="shared-actions">
              {/* "Nova aba" só faz sentido para formatos com visualizador nativo (PDF) */}
              {kind === 'pdf' && (
                <a href={url} target="_blank" rel="noreferrer" className="btn btn-secondary">
                  <IconExternalLink size={14} /> Nova aba
                </a>
              )}

              {canDownload ? (
                <button
                  className="btn btn-primary"
                  onClick={() => doc && downloadDocument(doc)}
                >
                  <IconDownload size={14} /> Baixar
                </button>
              ) : (
                <span className="shared-no-download">
                  Download não permitido pelo compartilhador
                </span>
              )}
            </div>
          )}

          {fileError && <p className="error-banner">{fileError}</p>}

          {/* Visualizador */}
          {!fileError && url && kind === 'pdf' && (
            <iframe title={doc.name} src={url} className="viewer-frame shared-frame" />
          )}

          {!fileError && kind === 'text' && (
            <pre className="viewer-text">{text ?? 'Carregando…'}</pre>
          )}

          {!fileError && url && (kind === 'word' || kind === 'excel' || kind === 'other') && (
            <div className="viewer-unsupported">
              <FileKindIcon kind={kind} size={40} />
              <p>Pré-visualização não disponível para este tipo de arquivo no navegador.</p>
              {canDownload ? (
                <button className="btn btn-primary" onClick={() => doc && downloadDocument(doc)}>
                  <IconDownload size={14} /> Baixar arquivo
                </button>
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
