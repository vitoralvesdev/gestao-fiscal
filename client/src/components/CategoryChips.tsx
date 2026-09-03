import type { CategoryCount } from '../types';

interface Props {
  categories: CategoryCount[];
  selected: string | null;
  onSelect: (category: string | null) => void;
  totalCount: number;
}

/** Retorna a parte mais descritiva de uma categoria para exibição em chip. */
function chipLabel(category: string, count: number): string {
  const lastSegment = category.split('/').pop() ?? category;
  return `${lastSegment} (${count})`;
}

export function CategoryChips({ categories, selected, onSelect, totalCount }: Props) {
  return (
    <div className="chips">
      <Chip
        label={`Todos (${totalCount})`}
        active={selected === null}
        onClick={() => onSelect(null)}
      />
      {categories.map((c) => (
        <Chip
          key={c.category}
          label={chipLabel(c.category, c.count)}
          title={c.category}
          active={selected === c.category}
          onClick={() => onSelect(c.category)}
        />
      ))}
    </div>
  );
}

function Chip({
  label,
  title,
  active,
  onClick,
}: {
  label: string;
  title?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`chip${active ? ' active' : ''}`}
      title={title}
    >
      {label}
    </button>
  );
}
