import { LegalDocView } from "./legal-doc-view";
import {
  privacySections,
  privacyToc,
  privacyUpdatedAt,
} from "./privacy-content";

export function PrivacyView() {
  return (
    <LegalDocView
      eyebrow="Legal"
      title="Política de privacidade"
      updatedAt={privacyUpdatedAt}
      intro="Esta política descreve como a Recomenda, uma solução 250k, trata dados pessoais na plataforma web e no WhatsApp (Lico)."
      toc={privacyToc}
      sections={privacySections}
    />
  );
}
