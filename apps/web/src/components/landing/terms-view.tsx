import { LegalDocView } from "./legal-doc-view";
import { termsSections, termsToc, termsUpdatedAt } from "./terms-content";

export function TermsView() {
  return (
    <LegalDocView
      eyebrow="Legal"
      title="Termos de uso"
      updatedAt={termsUpdatedAt}
      intro="Regras de uso da Recomenda na web e no WhatsApp (Lico). Uma solução 250k."
      toc={termsToc}
      sections={termsSections}
    />
  );
}
