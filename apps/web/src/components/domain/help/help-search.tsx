import {
  Children,
  cloneElement,
  Fragment,
  isValidElement,
  type ReactNode,
} from "react";

/** Sem acento e em minúsculas: "Fórmula", "formula" e "FÓRMULA" se encontram. */
function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Palavras da busca, já dobradas. Vazio = sem busca. */
export function searchTerms(query: string): string[] {
  return fold(query).split(/\s+/).filter(Boolean);
}

/**
 * Texto corrido de um conteúdo de ajuda. O conteúdo é JSX simples (`<p>`,
 * `<strong>`), então basta descer pelos `children`.
 */
export function nodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join(" ");
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return nodeText(node.props.children);
  }
  return "";
}

/** Toda palavra da busca aparece em algum dos textos (E, não OU). */
export function matchesTerms(terms: string[], ...texts: string[]): boolean {
  const haystack = fold(texts.join(" "));
  return terms.every((term) => haystack.includes(term));
}

/**
 * Filtra `items` pela busca, com quem bate no título primeiro — "dose" deve
 * trazer a fórmula da dose antes da que só cita dose no meio do texto.
 */
export function searchItems<T>(
  items: T[],
  terms: string[],
  fields: (item: T) => { title: string; body?: ReactNode },
): T[] {
  const inTitle: T[] = [];
  const inBody: T[] = [];
  for (const item of items) {
    const { title, body } = fields(item);
    if (matchesTerms(terms, title)) inTitle.push(item);
    else if (matchesTerms(terms, title, nodeText(body))) inBody.push(item);
  }
  return [...inTitle, ...inBody];
}

/** Trechos de `text` que batem com alguma palavra, já unidos quando se sobrepõem. */
function matchRanges(text: string, terms: string[]): [number, number][] {
  // Dobra caractere a caractere, guardando de onde cada um veio: o índice
  // achado no texto dobrado precisa voltar para o texto original.
  let folded = "";
  const start: number[] = [];
  const end: number[] = [];
  let index = 0;
  for (const char of text) {
    for (const piece of fold(char)) {
      folded += piece;
      start.push(index);
      end.push(index + char.length);
    }
    index += char.length;
  }

  const ranges: [number, number][] = [];
  for (const term of terms) {
    let at = folded.indexOf(term);
    while (at !== -1) {
      ranges.push([start[at], end[at + term.length - 1]]);
      at = folded.indexOf(term, at + term.length);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);

  const merged: [number, number][] = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

/** Destaca no texto as palavras da busca. */
export function highlightText(text: string, terms: string[]): ReactNode {
  if (terms.length === 0) return text;
  const ranges = matchRanges(text, terms);
  if (ranges.length === 0) return text;
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const [from, to] of ranges) {
    if (from > cursor) parts.push(text.slice(cursor, from));
    parts.push(
      <mark
        key={from}
        className="rounded-[0.2rem] bg-warning-soft text-text-strong"
      >
        {text.slice(from, to)}
      </mark>,
    );
    cursor = to;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

/** O mesmo, descendo por um conteúdo JSX sem mudar a estrutura dele. */
export function highlightNode(node: ReactNode, terms: string[]): ReactNode {
  if (terms.length === 0) return node;
  if (typeof node === "string" || typeof node === "number") {
    return highlightText(String(node), terms);
  }
  if (Array.isArray(node)) {
    return Children.toArray(node).map((child, i) => (
      <Fragment key={i}>{highlightNode(child, terms)}</Fragment>
    ));
  }
  if (
    isValidElement<{ children?: ReactNode }>(node) &&
    node.props.children != null
  ) {
    return cloneElement(node, undefined, highlightNode(node.props.children, terms));
  }
  return node;
}
