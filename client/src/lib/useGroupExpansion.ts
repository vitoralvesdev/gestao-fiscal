import { useEffect, useState } from 'react';

/**
 * Estado de expansão por chave (grupo ou seção), mesclado (nunca substituído inteiro) para
 * sobreviver a trocas de página/filtro sem "esquecer" chaves já vistas nem quebrar o cálculo
 * de allExpanded quando uma chave nova aparece ainda não vista.
 *
 * Recebe uma lista simples de chaves (não `DocGroup[]`) para poder incluir também seções
 * virtuais como a de arquivos "sem grupo", que não são um DocGroup de verdade.
 */
export function useGroupExpansion(keys: string[]) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(keys.map((key) => [key, true]))
  );

  useEffect(() => {
    setExpanded((prev) => {
      const missing = keys.filter((key) => !(key in prev));
      if (missing.length === 0) return prev;
      return { ...prev, ...Object.fromEntries(missing.map((key) => [key, true])) };
    });
  }, [keys]);

  const allExpanded = keys.every((key) => expanded[key] ?? true);

  function toggle(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleAll() {
    const next = !allExpanded;
    setExpanded((prev) => ({
      ...prev,
      ...Object.fromEntries(keys.map((key) => [key, next])),
    }));
  }

  return { expanded, allExpanded, toggle, toggleAll };
}
