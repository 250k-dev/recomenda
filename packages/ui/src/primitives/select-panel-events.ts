/** Painel do SearchableSelect é portado no `document.body` (coords de viewport). */
export const SELECT_PANEL_SLOT = "select-panel";

export function isSelectPanelEventTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest(`[data-slot="${SELECT_PANEL_SLOT}"]`))
  );
}
