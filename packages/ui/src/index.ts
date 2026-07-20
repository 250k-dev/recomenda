/**
 * Superfície pública de @recomenda/ui.
 *
 * O caminho preferido de consumo é por arquivo
 * (`@recomenda/ui/primitives/button`), que é melhor para tree-shaking — este
 * barril existe como entry-point do pacote.
 *
 * Barril por módulo, seguindo o precedente de A3/A5: são ~150 símbolos de
 * primitivos de apresentação, e uma lista nominal aqui seria ruído que nenhum
 * consumidor lê.
 *
 * As subpastas seguem a origem do código, não só o assunto:
 * `primitives/` é **exatamente** o conjunto vendored do shadcn, e é para onde o
 * `components.json` aponta o alias. Tudo em `forms/` e `patterns/` é escrito
 * aqui e o CLI não encosta. Ver o handoff B10.
 *
 * ⚠️ Invariante do pacote: nada aqui pode importar @recomenda/api,
 * @recomenda/domain, @recomenda/api-hooks ou next/*. Um primitivo que precisa
 * saber de dados ou navegar pertence a apps/web/src/components/domain.
 */

// ---- Primitivos base (shadcn vendored) ----
export * from "./primitives/alert";
export * from "./primitives/alert-dialog";
export * from "./primitives/badge";
export * from "./primitives/button";
export * from "./primitives/calendar";
export * from "./primitives/card";
export * from "./primitives/dialog";
export * from "./primitives/dropdown-menu";
export * from "./primitives/input";
export * from "./primitives/label";
export * from "./primitives/native-select";
export * from "./primitives/popover";
export * from "./primitives/separator";
export * from "./primitives/sheet";
export * from "./primitives/sidebar";
export * from "./primitives/skeleton";
export * from "./primitives/table";
export * from "./primitives/textarea";
export * from "./primitives/tooltip";

// ---- Entrada de dados ----
export * from "./forms/brazilian-date-input";
export * from "./forms/money-input";
export * from "./forms/password-input";
export * from "./forms/searchable-select";

// `select` re-exporta SearchableSelect/SearchableSelectOption de
// `searchable-select`. Com `export *` nos dois, esses nomes ficariam ambíguos e
// o ESM os removeria do barril **sem erro** — some da API pública em silêncio.
// Por isso este módulo é exportado nominalmente, só com o que é dele.
export { Select, type SelectOption, type SelectProps } from "./forms/select";

// ---- Composições ----
export * from "./patterns/confirm-dialog";
export * from "./patterns/data-table";
export * from "./patterns/empty-state";
export * from "./patterns/pagination-bar";
export * from "./patterns/progress-bar";
export * from "./patterns/section-title";

// ---- Hooks ----
export * from "./hooks/use-mobile";

// ---- Assets (logos e ícones em TSX, sem loader de SVG) ----
export * from "./assets/logo";
export * from "./assets/logo-250K";
export * from "./assets/whatsapp-icon";
