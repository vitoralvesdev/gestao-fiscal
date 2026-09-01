import { IconFolder, IconGrid } from './icons';
import type { CategoryCount } from '../types';

interface Props {
  categories: CategoryCount[];
  selected: string | null;
  onSelect: (category: string | null) => void;
  totalCount: number;
}

export function Sidebar({ categories, selected, onSelect, totalCount }: Props) {
  return (
    <nav className="nav-list">
      <NavItem
        icon={<IconGrid size={17} />}
        label="Todos os arquivos"
        count={totalCount}
        active={selected === null}
        onClick={() => onSelect(null)}
      />
      <div className="nav-section-title">Categorias</div>
      {categories.length === 0 && <p className="nav-empty">Nenhuma categoria ainda</p>}
      {categories.map((c) => (
        <NavItem
          key={c.category}
          icon={<IconFolder size={17} />}
          label={c.category}
          count={c.count}
          active={selected === c.category}
          onClick={() => onSelect(c.category)}
        />
      ))}
    </nav>
  );
}

function NavItem({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={`nav-item${active ? ' active' : ''}`}>
      {icon}
      <span className="label">{label}</span>
      <span className="nav-badge">{count}</span>
    </button>
  );
}
