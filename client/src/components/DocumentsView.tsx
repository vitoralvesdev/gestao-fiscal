import { useEffect, useMemo, useState } from 'react';
import { DocumentRow } from './DocumentRow';
import {
  FileKindIcon,
  IconDownload,
  IconFolder,
  IconListView,
  IconPencil,
  IconShare,
  IconTableView,
  IconTrash,
} from './icons';
import { groupDocuments } from '../lib/grouping';
import { useGroupExpansion } from '../lib/useGroupExpansion';
import { fileKind, formatDate, formatSize } from '../lib/format';
import type { DocumentItem } from '../types';

interface DocRowCallbacks {
  onOpen: (doc: DocumentItem) => void;
  onEdit: (doc: DocumentItem) => void;
  onDelete: (doc: DocumentItem) => void;
  onDownload: (doc: DocumentItem) => void;
  onShare: (doc: DocumentItem) => void;
}

interface Props extends DocRowCallbacks {
  docs: DocumentItem[];
}

type ViewMode = 'grouped' | 'list' | 'table';

const VIEW_MODE_KEY = 'gestao-fiscal:view-mode';

function loadViewMode(): ViewMode {
  try {
    const stored = localStorage.getItem(VIEW_MODE_KEY);
    if (stored === 'grouped' || stored === 'list' || stored === 'table') return stored;
  } catch {
    // localStorage indisponível (modo privado, etc.) — usa o padrão
  }
  return 'grouped';
}

const PATTERN_LABEL: Record<string, string> = {
  'month-year': 'mês/ano',
  'year': 'ano',
  'quarter': 'trimestre',
  'prefix': 'prefixo',
};

/** Chave virtual da seção "Outros" — precisa participar do mesmo estado de expansão
 * que os grupos de verdade, senão o botão "Expandir/Recolher tudo" nunca a alcança. */
const UNGROUPED_KEY = '__ungrouped__';

export function DocumentsView({ docs, ...callbacks }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>(loadViewMode);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_MODE_KEY, viewMode);
    } catch {
      // ignora — preferência de visualização não é essencial
    }
  }, [viewMode]);

  const result = useMemo(() => groupDocuments(docs), [docs]);
  const isGrouped = viewMode === 'grouped' && result.groups.length > 0;

  const expansionKeys = useMemo(() => {
    if (!isGrouped) return [];
    const keys = result.groups.map((g) => g.key);
    if (result.ungrouped.length > 0) keys.push(UNGROUPED_KEY);
    return keys;
  }, [isGrouped, result]);

  const { expanded, allExpanded, toggle, toggleAll } = useGroupExpansion(expansionKeys);

  return (
    <div className="doc-list">
      <div className="group-toolbar">
        <span className="group-toolbar-label">
          {isGrouped ? (
            <>
              Agrupado por{' '}
              <strong>{result.patternId ? (PATTERN_LABEL[result.patternId] ?? result.patternId) : 'padrão'}</strong>
              {' '}· {result.groups.length} grupo{result.groups.length !== 1 ? 's' : ''}
              {result.ungrouped.length > 0 && `, ${result.ungrouped.length} sem grupo`}
            </>
          ) : (
            `${docs.length} arquivo${docs.length !== 1 ? 's' : ''}`
          )}
        </span>
        <div className="group-toolbar-actions">
          {isGrouped && (
            <button className="btn btn-secondary group-toggle-all" onClick={toggleAll}>
              {allExpanded ? 'Recolher tudo' : 'Expandir tudo'}
            </button>
          )}
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {viewMode === 'table' ? (
        <TableView docs={docs} {...callbacks} />
      ) : isGrouped ? (
        <>
          {result.groups.map((group) => {
            const isOpen = expanded[group.key] ?? true;
            return (
              <div key={group.key} className="doc-group">
                <button
                  className={`doc-group-header${isOpen ? ' open' : ''}`}
                  onClick={() => toggle(group.key)}
                  aria-expanded={isOpen}
                >
                  <span className="doc-group-chevron" aria-hidden>›</span>
                  <span className="doc-group-label">{group.label}</span>
                  <span className="doc-group-count">
                    {group.docs.length} arquivo{group.docs.length !== 1 ? 's' : ''}
                  </span>
                </button>
                {isOpen && (
                  <div className="doc-group-body">
                    {group.docs.map((doc) => (
                      <DocumentRow key={doc.id} doc={doc} {...callbacks} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {result.ungrouped.length > 0 && (
            <UngroupedSection
              docs={result.ungrouped}
              callbacks={callbacks}
              isOpen={expanded[UNGROUPED_KEY] ?? true}
              onToggle={() => toggle(UNGROUPED_KEY)}
            />
          )}
        </>
      ) : (
        docs.map((doc) => <DocumentRow key={doc.id} doc={doc} {...callbacks} />)
      )}
    </div>
  );
}

// ── Alternador de modo de visualização ─────────────────────────────

const VIEW_OPTIONS: Array<{ mode: ViewMode; label: string }> = [
  { mode: 'grouped', label: 'Categoria' },
  { mode: 'list', label: 'Lista' },
  { mode: 'table', label: 'Tabela' },
];

function ViewModeToggle({ value, onChange }: { value: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <div className="view-mode-toggle" role="group" aria-label="Modo de visualização">
      {VIEW_OPTIONS.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          className={`view-mode-btn${value === mode ? ' active' : ''}`}
          onClick={() => onChange(mode)}
          title={label}
          aria-pressed={value === mode}
        >
          {mode === 'grouped' && <IconFolder size={15} />}
          {mode === 'list' && <IconListView size={15} />}
          {mode === 'table' && <IconTableView size={15} />}
          <span className="view-mode-label">{label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Seção "Outros" para arquivos não agrupados ────────────────────

function UngroupedSection({
  docs,
  callbacks,
  isOpen,
  onToggle,
}: {
  docs: DocumentItem[];
  callbacks: DocRowCallbacks;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="doc-group">
      <button className={`doc-group-header${isOpen ? ' open' : ''}`} onClick={onToggle} aria-expanded={isOpen}>
        <span className="doc-group-chevron" aria-hidden>›</span>
        <span className="doc-group-label">Outros</span>
        <span className="doc-group-count">{docs.length} arquivo{docs.length !== 1 ? 's' : ''}</span>
      </button>
      {isOpen && (
        <div className="doc-group-body">
          {docs.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} {...callbacks} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Visualização em tabela ──────────────────────────────────────────

function TableView({ docs, onOpen, onEdit, onDelete, onDownload, onShare }: DocRowCallbacks & { docs: DocumentItem[] }) {
  return (
    <div className="table-wrap">
      <table className="doc-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Categoria</th>
            <th>Tamanho</th>
            <th>Enviado em</th>
            <th aria-label="Ações" />
          </tr>
        </thead>
        <tbody>
          {docs.map((doc) => {
            const kind = fileKind(doc.name);
            return (
              <tr key={doc.id}>
                <td className="doc-table-name">
                  <button className="doc-table-name-btn" onClick={() => onOpen(doc)} title={doc.name}>
                    <FileKindIcon kind={kind} size={16} />
                    <span>{doc.name}</span>
                  </button>
                </td>
                <td>{doc.category}</td>
                <td>{formatSize(doc.size)}</td>
                <td>{formatDate(doc.uploadedAt)}</td>
                <td className="doc-table-actions">
                  <button className="icon-btn" title="Baixar" onClick={() => onDownload(doc)}>
                    <IconDownload size={15} />
                  </button>
                  <button
                    className={`icon-btn${doc.sharedToken ? ' active-share' : ''}`}
                    title={doc.sharedToken ? 'Link ativo — gerenciar compartilhamento' : 'Compartilhar'}
                    onClick={() => onShare(doc)}
                  >
                    <IconShare size={15} />
                  </button>
                  <button className="icon-btn" title="Editar" onClick={() => onEdit(doc)}>
                    <IconPencil size={15} />
                  </button>
                  <button className="icon-btn danger" title="Excluir" onClick={() => onDelete(doc)}>
                    <IconTrash size={15} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
