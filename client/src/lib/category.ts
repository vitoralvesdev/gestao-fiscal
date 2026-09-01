const MONTHS =
  '(Janeiro|Fevereiro|Março|Marco|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)';
const MONTH_YEAR_SUFFIX = new RegExp(`\\s+${MONTHS}\\s+\\d{4}\\s*$`, 'i');
const PARENS = /\(([^)]+)\)/;

/** Sugere uma categoria a partir do nome do arquivo, ex: "Fulano(Boleto Agosto 2026).pdf" -> "Boleto" */
export function suggestCategory(fileName: string): string {
  const withoutExt = fileName.replace(/\.[^./\\]+$/, '');
  const parensMatch = withoutExt.match(PARENS);
  const source = parensMatch ? parensMatch[1] : withoutExt;
  const withoutDate = source.replace(MONTH_YEAR_SUFFIX, '').trim();
  const cleaned = (withoutDate || source).trim();
  return cleaned ? toTitleCase(cleaned) : 'Outros';
}

function toTitleCase(text: string): string {
  return text
    .split(/\s+/)
    .map((word) => (word.length ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(' ');
}
