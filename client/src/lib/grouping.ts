import type { DocumentItem } from '../types';

// ── Padrões de token que reconhecemos como "chave de grupo" ───────

const MONTH_NAMES = [
  'janeiro','fevereiro','março','marco','abril','maio','junho',
  'julho','agosto','setembro','outubro','novembro','dezembro',
];

const MONTH_ABBR = [
  'jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez',
];

// Regex de padrões que queremos detectar nos nomes dos arquivos
const PATTERNS: Array<{ id: string; re: RegExp; label: (m: RegExpMatchArray) => string; order: (m: RegExpMatchArray) => number }> = [
  // "Agosto 2024" / "ago/2024" / "08/2024" / "agosto-2024"
  {
    id: 'month-year',
    re: new RegExp(
      `(${MONTH_NAMES.join('|')}|${MONTH_ABBR.join('|')})[\\s/._-]*(\\d{4})`,
      'i'
    ),
    label: (m) => {
      const rawMonth = m[1].toLowerCase().replace('marco','março');
      const month = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1);
      return `${month} ${m[2]}`;
    },
    // Ordena por ano + índice do mês para ter cronologia
    order: (m) => {
      const idx = [...MONTH_NAMES, ...MONTH_ABBR].findIndex(
        (n) => n === m[1].toLowerCase().replace('marco','março').slice(0, n.length)
      );
      return parseInt(m[2]) * 100 + (idx % 12);
    },
  },
  // Apenas ano: "2024", "2025" — só aplica se 4 dígitos isolados
  {
    id: 'year',
    re: /\b(20\d{2}|19\d{2})\b/,
    label: (m) => m[1],
    order: (m) => parseInt(m[1]),
  },
  // "Q1 2024" / "1T2024" / "Trimestre 1"
  {
    id: 'quarter',
    re: /\b(?:q([1-4])[^\d]*(20\d{2})|([1-4])t[^\d]*(20\d{2})|trimestre[\s_-]*([1-4]))\b/i,
    label: (m) => {
      const q = m[1] || m[3] || m[5];
      const y = m[2] || m[4] || '';
      return y ? `T${q} ${y}` : `Trimestre ${q}`;
    },
    order: (m) => {
      const q = parseInt(m[1] || m[3] || m[5] || '0');
      const y = parseInt(m[2] || m[4] || '0');
      return y * 10 + q;
    },
  },
  // Prefixo alfa-numérico separado por _ ou - (ex: "NF_001", "REC-2024")
  {
    id: 'prefix',
    re: /^([A-Za-zÀ-ú]{2,8})[_\-\s]/,
    label: (m) => m[1].toUpperCase(),
    order: (m) => m[1].toUpperCase().charCodeAt(0),
  },
];

// ── Tipos públicos ────────────────────────────────────────────────

export interface DocGroup {
  key: string;      // chave única do grupo
  label: string;    // rótulo exibido no cabeçalho
  order: number;    // para ordenação
  docs: DocumentItem[];
}

export interface GroupingResult {
  groups: DocGroup[];    // grupos encontrados
  ungrouped: DocumentItem[]; // docs que não se encaixaram em nenhum grupo
  patternId: string | null;  // qual padrão foi usado (para debug/info)
}

// ── Algoritmo principal ───────────────────────────────────────────

/**
 * Tenta agrupar uma lista de documentos pelo padrão mais recorrente nos nomes.
 *
 * Retorna grupos + docs não agrupados.
 * Se nenhum padrão cobre ≥ MIN_COVERAGE da lista, retorna `groups: []` indicando
 * que não vale exibir agrupamento.
 */
export function groupDocuments(docs: DocumentItem[]): GroupingResult {
  const EMPTY: GroupingResult = { groups: [], ungrouped: docs, patternId: null };
  if (docs.length < 3) return EMPTY;

  // Mínimo de arquivos que precisam compartilhar um token para ele virar grupo
  const MIN_GROUP_SIZE = 2;
  // Mínimo de cobertura total da lista para ativar o agrupamento
  const MIN_COVERAGE = 0.4;

  // Para cada padrão, tenta encontrar o melhor agrupamento
  type Candidate = {
    patternId: string;
    groups: DocGroup[];
    ungrouped: DocumentItem[];
    coverage: number;
  };

  let best: Candidate | null = null;

  for (const pattern of PATTERNS) {
    const buckets = new Map<string, { label: string; order: number; docs: DocumentItem[] }>();

    for (const doc of docs) {
      const nameWithoutExt = doc.name.replace(/\.[^./\\]+$/, '');
      const match = nameWithoutExt.match(pattern.re);
      if (!match) continue;

      const label = pattern.label(match);
      const key = `${pattern.id}::${label}`;

      if (!buckets.has(key)) {
        buckets.set(key, { label, order: pattern.order(match), docs: [] });
      }
      buckets.get(key)!.docs.push(doc);
    }

    // Filtra grupos pequenos demais
    const validBuckets = [...buckets.values()].filter(
      (b) => b.docs.length >= MIN_GROUP_SIZE
    );

    if (validBuckets.length < 2) continue; // precisa de pelo menos 2 grupos distintos

    const coveredCount = validBuckets.reduce((s, b) => s + b.docs.length, 0);
    const coverage = coveredCount / docs.length;

    if (coverage < MIN_COVERAGE) continue;

    if (!best || coverage > best.coverage) {
      const coveredIds = new Set(validBuckets.flatMap((b) => b.docs.map((d) => d.id)));
      best = {
        patternId: pattern.id,
        groups: validBuckets
          .sort((a, b) => a.order - b.order)
          .map((b) => ({ key: `${pattern.id}::${b.label}`, label: b.label, order: b.order, docs: b.docs })),
        ungrouped: docs.filter((d) => !coveredIds.has(d.id)),
        coverage,
      };
    }
  }

  if (!best) return EMPTY;

  return {
    groups: best.groups,
    ungrouped: best.ungrouped,
    patternId: best.patternId,
  };
}
