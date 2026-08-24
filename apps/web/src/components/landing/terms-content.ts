import { links } from "./content";

export const termsUpdatedAt = "24 de agosto de 2026";

export const termsToc = [
  { id: "servico", label: "O que é a Recomenda" },
  { id: "aceite", label: "Aceite" },
  { id: "conta", label: "Conta" },
  { id: "whatsapp", label: "WhatsApp (Lico)" },
  { id: "uso", label: "Uso aceitável" },
  { id: "responsabilidade", label: "Responsabilidade" },
  { id: "alteracoes", label: "Alterações" },
] as const;

export const termsSections = [
  {
    id: "servico",
    title: "O que é a Recomenda",
    body: [
      "A Recomenda é uma solução 250k para recomendações agrícolas, lista de compras, estoque e acompanhamento de safra.",
      "O serviço é usado na web (agrônomo e equipe) e no WhatsApp, pelo Lico (produtor).",
    ],
  },
  {
    id: "aceite",
    title: "Aceite",
    body: [
      "Ao criar conta, entrar na plataforma ou conversar com o Lico, você concorda com estes termos e com a Política de privacidade.",
      "Se não concordar, não use o serviço.",
    ],
  },
  {
    id: "conta",
    title: "Conta",
    body: [
      "A conta é pessoal. Mantenha login e senha em sigilo.",
      "A equipe é responsável pelos produtores, fazendas e dados que cadastra. O produtor é responsável pelas informações que envia ao Lico.",
    ],
  },
  {
    id: "whatsapp",
    title: "WhatsApp (Lico)",
    body: [
      "O Lico só atende número vinculado pela equipe da Recomenda.",
      "As mensagens servem à operação da safra (consulta, aplicação, estoque). Não enviamos oferta de terceiro sem relação com o serviço.",
      "O produtor encerra o atendimento enviando “sair”. Depois disso o Lico deixa de responder naquele número.",
    ],
  },
  {
    id: "uso",
    title: "Uso aceitável",
    body: [
      "Use a Recomenda só para a operação agrícola da sua equipe e dos seus produtores.",
      "É vedado tentar acessar conta de terceiros, sobrecarregar o serviço ou usar o canal do WhatsApp para spam.",
    ],
  },
  {
    id: "responsabilidade",
    title: "Responsabilidade",
    body: [
      "A Recomenda apoia a recomendação e o registro de campo. Não substitui o julgamento profissional do agrônomo nem a decisão do produtor na lavoura.",
      "O serviço é prestado como está. Interrupções de internet, WhatsApp ou infraestrutura de terceiros podem ocorrer.",
    ],
  },
  {
    id: "alteracoes",
    title: "Alterações e contato",
    body: [
      "Podemos atualizar estes termos. A data no topo desta página indica a versão vigente.",
      `Dúvidas: ${links.contactEmail}. Aplica-se a legislação brasileira.`,
    ],
  },
] as const;
