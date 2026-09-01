import type { CategoryCount } from '../types';

interface Props {
  categories: CategoryCount[];
  selected: string | null;
  onSelect: (category: string | null) => void;
  totalCount: number;
}

export function CategoryChips({ categories, selected, onSelect, totalCount }: Props) {
  return (
    <div className="chips">
      <Chip label={`Todos (${totalCount})`} active={selected === null} onClick={() => onSelect(null)} />
      {categories.map((c) => (
        <Chip
          key={c.category}
          label={`${c.category} (${c.count})`}
          active={selected === c.category}
          onClick={() => onSelect(c.category)}
        />
      ))}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`chip${active ? ' active' : ''}`}>
      {label}
    </button>
  );
}
