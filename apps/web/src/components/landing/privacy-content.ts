import { links } from "./content";

export const privacyUpdatedAt = "24 de agosto de 2026";

export const privacyToc = [
  { id: "controlador", label: "Quem controla os dados" },
  { id: "dados", label: "Quais dados tratamos" },
  { id: "finalidade", label: "Para que usamos" },
  { id: "whatsapp", label: "WhatsApp e Meta" },
  { id: "compartilhamento", label: "Compartilhamento" },
  { id: "cookies", label: "Cookies de sessão" },
  { id: "direitos", label: "Seus direitos (LGPD)" },
  { id: "retencao", label: "Conservação e opt-out" },
] as const;

export const privacySections = [
  {
    id: "controlador",
    title: "Quem controla os dados",
    body: [
      "A 250k é a controladora dos dados pessoais tratados na Recomenda, na plataforma web e no atendimento pelo WhatsApp (Lico).",
      `Pedidos de acesso, correção ou exclusão: ${links.contactEmail}.`,
    ],
  },
  {
    id: "dados",
    title: "Quais dados tratamos",
    body: [
      "Conta e perfil: nome, e-mail, telefone e dados de acesso da equipe e dos produtores.",
      "Operação agrícola: produtores, fazendas, talhões, safras, recomendações, estoque e listas de compras.",
      "WhatsApp / Lico: número vinculado, mensagens necessárias para atender o pedido e o registro de opt-in/opt-out.",
    ],
  },
  {
    id: "finalidade",
    title: "Para que usamos",
    body: [
      "Prestar o serviço de recomendação agrícola, acompanhar a execução no campo e enviar avisos operacionais pelo Lico.",
      "Autenticar usuários, manter a sessão e cumprir obrigações legais.",
      "Melhorar o produto com dados agregados. Não usamos o conteúdo das conversas para anúncios de terceiros.",
    ],
  },
  {
    id: "whatsapp",
    title: "WhatsApp e Meta",
    body: [
      "O Lico atende o produtor no WhatsApp pela WhatsApp Business Platform (Cloud API) da Meta.",
      "A 250k é a controladora. A Meta processa o envio e o recebimento das mensagens para entregar o serviço, nos termos da plataforma WhatsApp Business.",
      "Só conversamos no WhatsApp com número vinculado pela equipe da Recomenda. O produtor pode encerrar o atendimento a qualquer momento enviando “sair”.",
      "Não vendemos o conteúdo das conversas. Não usamos essas mensagens para publicidade.",
    ],
  },
  {
    id: "compartilhamento",
    title: "Compartilhamento",
    body: [
      "Meta / WhatsApp: para entregar as mensagens do Lico no WhatsApp do produtor.",
      "Lojista: somente os dados do link de precificação que o produtor ou a equipe escolherem compartilhar.",
      "Infraestrutura (hospedagem, e-mail, monitoramento) sob contrato, no limite necessário para operar a Recomenda.",
    ],
  },
  {
    id: "cookies",
    title: "Cookies de sessão",
    body: [
      "Usamos cookies essenciais de autenticação (access token, refresh token e papel do usuário) para manter você logado.",
      "Não utilizamos cookies de publicidade na landing nem na plataforma web.",
    ],
  },
  {
    id: "direitos",
    title: "Seus direitos (LGPD)",
    body: [
      "Você pode solicitar confirmação de tratamento, acesso, correção, anonimização, portabilidade ou exclusão dos seus dados, nos termos da Lei nº 13.709/2018.",
      `Para exercer esses direitos, escreva para ${links.contactEmail}. Atendemos o pedido pelo mesmo canal.`,
    ],
  },
  {
    id: "retencao",
    title: "Conservação e opt-out do Lico",
    body: [
      "Mantemos os dados pelo tempo necessário à prestação do serviço e às obrigações legais.",
      "No WhatsApp, enviar “sair” desvincula o contato e interrompe as respostas do Lico.",
      "Pedido de exclusão da conta e dos dados pessoais: use o e-mail de contato. Confirmamos o atendimento por escrito.",
    ],
  },
] as const;
