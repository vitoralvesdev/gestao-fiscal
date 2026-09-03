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

/**
 * Deriva a categoria a partir do caminho relativo de um arquivo dentro de uma pasta.
 *
 * Regras:
 * - O caminho tem o formato "pasta/[subpasta/...]arquivo.pdf" (webkitRelativePath).
 * - O primeiro segmento é a pasta raiz selecionada pelo usuário — descartado.
 * - Os segmentos intermediários viram categoria com "/" como separador (subcategorias).
 * - Se só há um segmento de pasta (arquivo direto na raiz), usa-se o nome da pasta raiz.
 *
 * Exemplos:
 *   "Documentos/boleto.pdf"           → "Documentos"
 *   "Documentos/Agosto/boleto.pdf"    → "Documentos/Agosto"
 *   "Docs/NF/Sub/arquivo.pdf"         → "Docs/NF/Sub"
 */
export function suggestCategoryFromPath(relativePath: string): string {
  // Normaliza separadores (Windows usa \)
  const normalized = relativePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  // parts = [rootFolder, ...subFolders, fileName]
  if (parts.length <= 2) {
    // Arquivo direto na pasta raiz — usa nome da pasta raiz
    return toTitleCase(parts[0]);
  }
  // Descarta o último segmento (nome do arquivo)
  const folders = parts.slice(0, -1);
  return folders.map(toTitleCase).join('/');
}

function toTitleCase(text: string): string {
  return text
    .split(/\s+/)
    .map((word) => (word.length ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(' ');
}
