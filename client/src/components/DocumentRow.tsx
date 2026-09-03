import { IconDownload, IconPencil, IconTrash, IconShare } from './icons';
import type { DocumentItem } from '../types';
import { fileKind, formatDate, formatSize } from '../lib/format';
import { FileKindIcon } from './icons';

interface Props {
  doc: DocumentItem;
  onOpen: (doc: DocumentItem) => void;
  onEdit: (doc: DocumentItem) => void;
  onDelete: (doc: DocumentItem) => void;
  onDownload: (doc: DocumentItem) => void;
  onShare: (doc: DocumentItem) => void;
}

export function DocumentRow({ doc, onOpen, onEdit, onDelete, onDownload, onShare }: Props) {
  const kind = fileKind(doc.name);
  return (
    <div className="doc-row">
      <button className="doc-open" onClick={() => onOpen(doc)}>
        <span className="doc-icon">
          <FileKindIcon kind={kind} size={20} />
        </span>
        <span className="doc-info">
          <span className="doc-name">{doc.name}</span>
          <span className="doc-meta">
            {doc.category} · {formatSize(doc.size)} · {formatDate(doc.uploadedAt)}
          </span>
        </span>
      </button>
      <div className="doc-actions">
        <button className="icon-btn" title="Baixar" onClick={() => onDownload(doc)}>
          <IconDownload size={16} />
        </button>
        <button
          className={`icon-btn${doc.sharedToken ? ' active-share' : ''}`}
          title={doc.sharedToken ? 'Link ativo — gerenciar compartilhamento' : 'Compartilhar'}
          onClick={() => onShare(doc)}
        >
          <IconShare size={16} />
        </button>
        <button className="icon-btn" title="Editar" onClick={() => onEdit(doc)}>
          <IconPencil size={16} />
        </button>
        <button className="icon-btn danger" title="Excluir" onClick={() => onDelete(doc)}>
          <IconTrash size={16} />
        </button>
      </div>
    </div>
  );
}
