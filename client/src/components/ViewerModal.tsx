import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import type { DocumentItem } from '../types';
import { fileKind, formatDate, formatSize } from '../lib/format';
import { readFile } from '../lib/fsAccess';
import { FileKindIcon, IconDownload, IconExternalLink } from './icons';

interface Props {
  root: FileSystemDirectoryHandle;
  doc: DocumentItem;
  onClose: () => void;
}

export function ViewerModal({ root, doc, onClose }: Props) {
  const kind = fileKind(doc.name);
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    readFile(root, doc.category, doc.name)
      .then(async (file) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(file);
        setUrl(objectUrl);
        if (kind === 'text') setText(await file.text());
      })
      .catch(() => {
        if (!cancelled) setError('Não foi possível abrir o arquivo.');
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, doc.category, doc.name]);

  return (
    <Modal title={doc.name} onClose={onClose} wide>
      <div className="viewer-toolbar">
        <span>
          {doc.category} · {formatSize(doc.size)} · {formatDate(doc.lastModified)}
        </span>
        {url && (
          <div className="viewer-actions">
            <a href={url} target="_blank" rel="noreferrer" className="btn btn-secondary">
              <IconExternalLink size={14} /> Nova aba
            </a>
            <a href={url} download={doc.name} className="btn btn-secondary">
              <IconDownload size={14} /> Baixar
            </a>
          </div>
        )}
      </div>

      {error && <p className="error-banner">{error}</p>}

      {!error && url && kind === 'pdf' && (
        <iframe title={doc.name} src={url} className="viewer-frame" />
      )}
      {!error && kind === 'text' && (
        <pre className="viewer-text">{text ?? 'Carregando…'}</pre>
      )}
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
