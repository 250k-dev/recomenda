import { routes } from "@recomenda/config";

/**
 * Conteúdo da landing page da Recomenda (pt-BR).
 * Centralizado para manter os componentes enxutos e o texto fácil de revisar.
 */

export type IconName =
  | "sprout"
  | "calendar"
  | "beaker"
  | "clipboard"
  | "boxes"
  | "chart"
  | "wifiOff"
  | "users"
  | "refresh"
  | "tag"
  | "shield"
  | "layers"
  | "phone"
  | "monitor"
  | "wheat"
  | "handshake"
  | "route"
  | "bell";

/**
 * Configuração pública, lida das variáveis de ambiente (.env → NEXT_PUBLIC_*).
 * Os fallbacks garantem que a página funcione mesmo sem um arquivo .env.
 *
 * Domínio de produção — usado no metadata e na barra de endereço do mock.
 */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://recomenda.vercel.app";
/** Apenas o host, ex.: "recomenda.vercel.app" — exibido no mock do painel. */
export const siteHost = new URL(siteUrl).host;

/**
 * Links de acesso. `appUrl` é a rota de login no mesmo origin;
 * `subscribe` é uma âncora interna.
 */
export const links = {
  appUrl: routes.login(),
  subscribe: "#assinar",
  privacy: routes.privacidade,
  terms: routes.termos,
  contactEmail:
    process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "marketing@250k.org",
} as const;

export const nav = [
  { label: "Recursos", href: "#recursos" },
  { label: "Para quem é", href: "#para-quem" },
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Onde usa", href: "#canais" },
  { label: "Perguntas", href: "#perguntas" },
] as const;

export type Feature = {
  icon: IconName;
  title: string;
  description: string;
};

export const features: Feature[] = [
  {
    icon: "layers",
    title: "Modelos de recomendação",
    description:
      "Configure os modelos de época (timing) e os mixes de produtos uma vez e reutilize em todos os talhões e safras. Sem recomeçar do zero a cada ciclo.",
  },
  {
    icon: "refresh",
    title: "Datas que se recalculam sozinhas",
    description:
      "Aplicou depois do previsto? A Recomenda recalcula automaticamente as próximas etapas e mostra a data original ao lado da nova para comparar.",
  },
  {
    icon: "clipboard",
    title: "Lista de compras pronta",
    description:
      "Cada safra gera uma lista de compras por talhão, com doses por hectare, quantidades totais e preços em R$ e US$. Compartilhe o link de precificação com o lojista.",
  },
  {
    icon: "boxes",
    title: "Estoque no automático",
    description:
      "O estoque do produtor é debitado a cada aplicação e creditado nas compras. Sempre dá para ver o que já tem e o que ainda falta comprar.",
  },
  {
    icon: "tag",
    title: "Precificação com o lojista",
    description:
      "Gere um link de precificação para o lojista fechar os valores — em dinheiro ou em sacas. Compare o que foi recomendado com o que foi comprado.",
  },
  {
    icon: "chart",
    title: "Relatórios de resultado",
    description:
      "Custo por hectare, produtividade e o comparativo entre planejado e executado. Feche a safra com números para embasar a próxima recomendação.",
  },
];

export type Persona = {
  id: string;
  name: string;
  role: string;
  channel: string;
  icon: IconName;
  accent: "brand" | "clay";
  points: string[];
};

export const personas: Persona[] = [
  {
    id: "agronomo",
    name: "Agrônomo e equipe",
    role: "Planeje e recomende com método",
    channel: "Web",
    icon: "sprout",
    accent: "brand",
    points: [
      "Modelos de época e mixes reutilizáveis por cultura",
      "Recomendação por safra e por talhão em minutos",
      "Catálogo de produtos com preços",
      "Acompanhe a execução de cada produtor no campo",
      "Link de precificação para o lojista",
    ],
  },
  {
    id: "produtor",
    name: "Produtor rural",
    role: "Execute no campo pelo WhatsApp",
    channel: "WhatsApp",
    icon: "wheat",
    accent: "clay",
    points: [
      "Receba a lista de compras já organizada",
      "Fale com o Lico no WhatsApp para acompanhar a safra",
      "Substitua produtos quando precisar, sem burocracia",
      "Feche a safra registrando a colheita e o resultado",
    ],
  },
];

export type Step = {
  number: string;
  title: string;
  description: string;
  icon: IconName;
};

export const steps: Step[] = [
  {
    number: "01",
    title: "Configure uma vez",
    description:
      "Monte seus modelos de época e mixes de produtos por cultura. Eles viram a base de todas as recomendações.",
    icon: "layers",
  },
  {
    number: "02",
    title: "Recomende por safra",
    description:
      "Crie a safra no talhão, aplique um modelo e a Recomenda gera as etapas, as datas e a lista de compras.",
    icon: "route",
  },
  {
    number: "03",
    title: "Registre no campo",
    description:
      "O produtor aprova, aplica, substitui produtos e atualiza o estoque pelo WhatsApp, com o Lico. Dúvida no talhão? É só mandar mensagem.",
    icon: "clipboard",
  },
  {
    number: "04",
    title: "Precifique e colha",
    description:
      "Feche os valores com o lojista pelo link de precificação e acompanhe custo, produtividade e resultado da safra.",
    icon: "chart",
  },
];

export type Faq = {
  question: string;
  answer: string;
};

export const faqs: Faq[] = [
  {
    question: "Para quem é a Recomenda?",
    answer:
      "Para o agrônomo e a equipe que planejam a recomendação, e para o produtor que executa no campo. A mesma plataforma, com visões diferentes para cada um.",
  },
  {
    question: "Quais culturas são atendidas?",
    answer:
      "Hoje a Recomenda trabalha com soja e milho, as duas principais culturas do campo brasileiro, com modelos e cálculos pensados para o ciclo de cada uma.",
  },
  {
    question: "Preciso instalar alguma coisa?",
    answer:
      "Não. No escritório, o agrônomo e a equipe acessam pelo navegador. No campo, o produtor conversa com o Lico no WhatsApp — sem instalar aplicativo da Recomenda.",
  },
  {
    question: "O que acontece quando uma aplicação atrasa?",
    answer:
      "A Recomenda recalcula automaticamente as datas das próximas etapas a partir da data real da aplicação — e mantém a data originalmente prevista à vista, para você comparar o planejado com o executado.",
  },
  {
    question: "Como funciona a precificação?",
    answer:
      "Depois do registro, a plataforma gera um link de precificação para o produtor ou o gerente compartilhar com o lojista. O lojista acessa e define os valores, em dinheiro ou em sacas.",
  },
  {
    question: "Como faço para assinar?",
    answer:
      "É só falar com o nosso time pela seção de contato. A gente ajuda na escolha do plano — que funciona por cota de talhões ativos — e na configuração inicial dos seus modelos.",
  },
];
