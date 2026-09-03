import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import type { DocumentItem } from '../types';
import { fileKind, formatDate, formatSize } from '../lib/format';
import { downloadDocument, getDocumentUrl } from '../lib/documents';
import { FileKindIcon, IconDownload, IconExternalLink } from './icons';

interface Props {
  doc: DocumentItem;
  onClose: () => void;
}

export function ViewerModal({ doc, onClose }: Props) {
  const kind = fileKind(doc.name);
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDocumentUrl(doc)
      .then(async (downloadUrl) => {
        if (cancelled) return;
        setUrl(downloadUrl);
        if (kind === 'text') {
          const response = await fetch(downloadUrl);
          setText(await response.text());
        }
      })
      .catch(() => {
        if (!cancelled) setError('Não foi possível abrir o arquivo.');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id, doc.storagePath]);

  return (
    <Modal title={doc.name} onClose={onClose} wide>
      <div className="viewer-toolbar">
        <span>
          {doc.category} · {formatSize(doc.size)} · {formatDate(doc.uploadedAt)}
        </span>
        {url && (
          <div className="viewer-actions">
            <a href={url} target="_blank" rel="noreferrer" className="btn btn-secondary">
              <IconExternalLink size={14} /> Nova aba
            </a>
            <button onClick={() => downloadDocument(doc)} className="btn btn-secondary">
              <IconDownload size={14} /> Baixar
            </button>
          </div>
        )}
      </div>

      {error && <p className="error-banner">{error}</p>}

      {!error && url && kind === 'pdf' && (
        <iframe title={doc.name} src={url} className="viewer-frame" />
      )}
      {!error && kind === 'text' && <pre className="viewer-text">{text ?? 'Carregando…'}</pre>}
      {!error && url && (kind === 'word' || kind === 'excel' || kind === 'other') && (
        <div className="viewer-unsupported">
          <FileKindIcon kind={kind} size={40} />
          <p>Pré-visualização não disponível para este tipo de arquivo no navegador.</p>
          <p>Use "Nova aba" ou "Baixar" para abrir com o aplicativo padrão.</p>
        </div>
      )}
    </Modal>
  );
}
