import { useState } from 'react';
import { IconFolder, IconGrid } from './icons';
import type { CategoryCount } from '../types';

interface Props {
  categories: CategoryCount[];
  selected: string | null;
  onSelect: (category: string | null) => void;
  totalCount: number;
}

/**
 * Transforma a lista plana de categorias num nó de árvore para renderização hierárquica.
 * Categorias com "/" são tratadas como subcategorias.
 * Ex: ["Boletos", "Boletos/Agosto 2026", "NF"] → dois nós raiz, "Boletos" com um filho.
 */
interface TreeNode {
  segment: string;   // só o último segmento do caminho
  fullPath: string;  // caminho completo da categoria
  count: number;     // arquivos diretamente nesta categoria (não inclui filhos)
  children: TreeNode[];
}

function buildTree(categories: CategoryCount[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();

  // Garante que todos os ancestrais existam no mapa
  for (const { category, count } of categories) {
    const parts = category.split('/');
    let path = '';
    for (let i = 0; i < parts.length; i++) {
      const segment = parts[i];
      path = i === 0 ? segment : `${path}/${segment}`;
      if (!nodeMap.has(path)) {
        nodeMap.set(path, { segment, fullPath: path, count: 0, children: [] });
      }
    }
    nodeMap.get(category)!.count = count;
  }

  // Liga nós ao pai
  const roots: TreeNode[] = [];
  for (const [path, node] of nodeMap) {
    const lastSlash = path.lastIndexOf('/');
    if (lastSlash === -1) {
      roots.push(node);
    } else {
      const parentPath = path.slice(0, lastSlash);
      nodeMap.get(parentPath)?.children.push(node);
    }
  }

  // Ordena tudo por label
  function sortNodes(nodes: TreeNode[]) {
    nodes.sort((a, b) => a.segment.localeCompare(b.segment, 'pt-BR'));
    for (const n of nodes) sortNodes(n.children);
  }
  sortNodes(roots);

  return roots;
}

export function Sidebar({ categories, selected, onSelect, totalCount }: Props) {
  const tree = buildTree(categories);

  return (
    <nav className="nav-list">
      <NavItem
        icon={<IconGrid size={17} />}
        label="Todos os arquivos"
        count={totalCount}
        active={selected === null}
        depth={0}
        onClick={() => onSelect(null)}
      />
      <div className="nav-section-title">Categorias</div>
      {categories.length === 0 && <p className="nav-empty">Nenhuma categoria ainda</p>}
      {tree.map((node) => (
        <TreeNodeItem
          key={node.fullPath}
          node={node}
          selected={selected}
          onSelect={onSelect}
          depth={0}
        />
      ))}
    </nav>
  );
}

function TreeNodeItem({
  node,
  selected,
  onSelect,
  depth,
}: {
  node: TreeNode;
  selected: string | null;
  onSelect: (category: string | null) => void;
  depth: number;
}) {
  const hasChildren = node.children.length > 0;
  // Expande automaticamente se algum filho (ou o próprio nó) está selecionado
  const [expanded, setExpanded] = useState(() =>
    selected === node.fullPath ||
    (selected?.startsWith(node.fullPath + '/') ?? false)
  );

  return (
    <>
      <NavItem
        icon={<IconFolder size={17} />}
        label={node.segment}
        count={node.count}
        active={selected === node.fullPath}
        depth={depth}
        hasChildren={hasChildren}
        expanded={expanded}
        onToggle={hasChildren ? () => setExpanded((v) => !v) : undefined}
        onClick={() => {
          if (node.count > 0) onSelect(node.fullPath);
          else if (hasChildren) setExpanded((v) => !v);
        }}
      />
      {hasChildren && expanded &&
        node.children.map((child) => (
          <TreeNodeItem
            key={child.fullPath}
            node={child}
            selected={selected}
            onSelect={onSelect}
            depth={depth + 1}
          />
        ))}
    </>
  );
}

function NavItem({
  icon,
  label,
  count,
  active,
  depth,
  hasChildren,
  expanded,
  onToggle,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  depth: number;
  hasChildren?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  onClick: () => void;
}) {
  return (
    <div
      className={`nav-item-row${active ? ' active' : ''}`}
      style={{ paddingLeft: `${10 + depth * 16}px` }}
    >
      <button onClick={onClick} className={`nav-item-btn`} title={label}>
        {icon}
        <span className="label">{label}</span>
        {count > 0 && <span className="nav-badge">{count}</span>}
      </button>
      {hasChildren && (
        <button
          className="nav-expand-btn"
          onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
          aria-label={expanded ? 'Recolher' : 'Expandir'}
        >
          <span className={`nav-expand-icon${expanded ? ' open' : ''}`}>›</span>
        </button>
      )}
    </div>
  );
}
