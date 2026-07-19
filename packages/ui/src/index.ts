/**
 * Superfície pública de @recomenda/ui.
 *
 * O caminho preferido de consumo é por arquivo (`@recomenda/ui/button`), que é
 * melhor para tree-shaking — este barril existe como entry-point do pacote.
 *
 * Barril por módulo, seguindo o precedente de A3/A5: são ~150 símbolos de
 * primitivos de apresentação, e uma lista nominal aqui seria ruído que nenhum
 * consumidor lê.
 *
 * ⚠️ Invariante do pacote: nada aqui pode importar @recomenda/api,
 * @recomenda/domain, @recomenda/api-hooks ou next/*. Um primitivo que precisa
 * saber de dados ou navegar pertence a apps/web/src/components/domain.
 */

// ---- Primitivos base ----
export * from "./alert";
export * from "./alert-dialog";
export * from "./badge";
export * from "./button";
export * from "./card";
export * from "./dialog";
export * from "./dropdown-menu";
export * from "./label";
export * from "./popover";
export * from "./separator";
export * from "./sheet";
export * from "./skeleton";
export * from "./table";
export * from "./tooltip";

// ---- Entrada de dados ----
export * from "./brazilian-date-input";
export * from "./calendar";
export * from "./dose-unit-select";
export * from "./input";
export * from "./money-input";
export * from "./native-select";
export * from "./password-input";
export * from "./searchable-select";
export * from "./textarea";

// `select` re-exporta SearchableSelect/SearchableSelectOption de
// `searchable-select`. Com `export *` nos dois, esses nomes ficariam ambíguos e
// o ESM os removeria do barril **sem erro** — some da API pública em silêncio.
// Por isso este módulo é exportado nominalmente, só com o que é dele.
export { Select, type SelectOption, type SelectProps } from "./select";

// ---- Composições ----
export * from "./confirm-dialog";
export * from "./data-table";
export * from "./empty-state";
export * from "./pagination-bar";
export * from "./progress-bar";
export * from "./section-title";
export * from "./sidebar";

// ---- Hooks ----
export * from "./use-mobile";

// ---- Assets (logos e ícones em TSX, sem loader de SVG) ----
export * from "./assets/logo";
export * from "./assets/logo-250K";
export * from "./assets/whatsapp-icon";
