import type {
  HelpContext,
  HelpFaqItem,
  HelpFormula,
  HelpGlossaryTerm,
  HelpSection,
  HelpShortcut,
  HelpTourStep,
} from "./types";

/*
 * Ajuda que vale para qualquer tela. Tudo aqui descreve comportamento que o
 * código implementa de fato — ao mudar uma regra (janela, DAP, receita,
 * sacas), atualize o texto correspondente. As referências `pacote/arquivo`
 * nos comentários apontam de onde cada afirmação saiu.
 */

// ---------------------------------------------------------------------------
// Tour da interface
// ---------------------------------------------------------------------------

/**
 * Alvos `data-tour` da casca. Ficam no header (agrônomo) e no sidebar (admin);
 * os que não estiverem visíveis para o usuário são pulados pelo tour.
 */
export function interfaceTour(ctx: HelpContext): HelpTourStep[] {
  const intro: HelpTourStep = {
    target: null,
    title: "Tour da interface",
    content:
      "Em poucos passos, você conhece o que fica sempre à mão em qualquer tela do Recomenda.",
  };
  const help: HelpTourStep = {
    target: "help",
    title: "Ajuda",
    content:
      "Sempre que tiver dúvida, abra a ajuda: ela traz tour, documentação e cálculos da tela em que você está.",
  };
  const notifications: HelpTourStep = {
    target: "notifications",
    title: "Notificações",
    content:
      "Etapas vencendo ou atrasadas, safras publicadas, pedidos pelo WhatsApp e atividade da equipe. Clique num aviso para ir direto à tela dele.",
  };

  if (ctx.shell === "admin") {
    return [
      intro,
      {
        target: "sidebar-nav",
        title: "Menu principal",
        content:
          "Todas as áreas da administração. Recolha o menu com ⌘B (ou Ctrl+B) para ganhar espaço.",
        placement: "right",
      },
      notifications,
      help,
      {
        target: "sidebar-profile",
        title: "Seu perfil",
        content: "Seus dados de acesso e preferências da conta.",
        placement: "right",
      },
    ];
  }

  return [
    intro,
    {
      target: "breadcrumb",
      title: "Onde você está",
      content:
        "A trilha mostra o caminho até esta tela — clique num nível para voltar a ele. No celular, a seta ao lado do título volta um nível.",
    },
    {
      target: "producer-search",
      title: "Buscar produtor",
      content:
        "Encontre qualquer produtor pelo nome ou e-mail, de qualquer tela. Atalho: ⌘K (ou Ctrl+K).",
    },
    {
      target: "scope-switcher",
      title: "Trocar de carteira",
      content:
        "Alterna entre a sua carteira e as gestões em que você atua. Produtores, agenda e equipe passam a ser os da carteira escolhida.",
    },
    help,
    notifications,
    {
      target: "user-menu",
      title: "Seu menu",
      content: "Perfil, atalhos da sua conta e o botão de sair.",
    },
  ];
}

// ---------------------------------------------------------------------------
// Guia geral
// ---------------------------------------------------------------------------

export function generalGuide(ctx: HelpContext): HelpSection[] {
  if (ctx.shell === "admin") {
    return [
      {
        title: "Navegação",
        body: (
          <p>
            O menu à esquerda leva a cada área da administração. Ele pode ser
            recolhido para mostrar só os ícones — passe o mouse sobre um ícone
            para ver o nome da área.
          </p>
        ),
      },
      notificationsSection,
    ];
  }

  return [
    {
      title: "Navegação",
      body: (
        <>
          <p>
            No topo de cada tela, a trilha mostra o caminho até ela, começando
            em Início. Clique em qualquer nível para voltar a ele.
          </p>
          <p>No celular, a seta ao lado do título volta um nível de cada vez.</p>
        </>
      ),
    },
    ...(ctx.canSearchProducers
      ? [
          {
            title: "Busca de produtor",
            body: (
              <p>
                A busca do topo encontra produtores pelo nome ou e-mail, de
                qualquer tela. Abra com ⌘K (ou Ctrl+K), use as setas para
                escolher um resultado e Enter para abrir.
              </p>
            ),
          },
        ]
      : []),
    ...(ctx.hasMultipleScopes
      ? [
          {
            title: "Carteiras e gestões",
            body: (
              <p>
                Se você atua na carteira de outro agrônomo, o seletor com o
                ícone de maleta troca de carteira. Enquanto estiver numa
                gestão, uma faixa verde no topo indica qual é — e o botão
                “Sair desta carteira” volta para a sua.
              </p>
            ),
          },
        ]
      : []),
    notificationsSection,
    {
      title: "O que aparece para você",
      body: (
        <p>
          Os menus e as ações dependem do seu papel e do seu nível de acesso
          (agrônomo, gestor, consultor, gerente, operador ou produtor). Se um
          item que você esperava não aparece, é provável que ele não faça parte
          do seu acesso.
        </p>
      ),
    },
  ];
}

const notificationsSection: HelpSection = {
  title: "Notificações",
  body: (
    <p>
      O ponto vermelho no sino indica avisos não lidos. Clique num aviso para
      ir à tela relacionada — ele é marcado como lido. “Marcar todas como
      lidas” limpa a lista de uma vez.
    </p>
  ),
};

// ---------------------------------------------------------------------------
// Cálculos gerais
// ---------------------------------------------------------------------------

/** Contas que aparecem em várias telas (cronograma, receita, lista, custo). */
export function generalFormulas(ctx: HelpContext): HelpFormula[] {
  if (ctx.shell === "admin") return [];
  return [
    {
      // domain/timing/dap.ts
      name: "DAP — dias após o plantio",
      expressions: ["DAP = data da etapa − data de plantio"],
      description:
        "Contado em dias corridos. No dia do plantio aparece “No plantio”; antes dele, “N dias antes do plantio”.",
      example: "Plantio em 10/10 e aplicação em 14/11 → 35 DAP.",
    },
    {
      // domain/timing/window-days.ts
      name: "Janela de aplicação",
      expressions: ["Janela = dia-alvo − 2 dias  até  dia-alvo + 2 dias"],
      description:
        "Cada etapa tem uma tolerância fixa de 2 dias para cada lado do dia-alvo.",
      example: "Dia-alvo 35 DAP → janela de 33 a 37 DAP.",
    },
    {
      // domain/recommendations/format.ts — displayRecStatus
      name: "Quando uma etapa fica “Atrasado”",
      expressions: [
        "Atrasado = etapa pendente  e  hoje > data prevista + metade da janela",
      ],
      description:
        "Vale só para etapas pendentes com data prevista. Dessecação nunca fica atrasada automaticamente — é sempre manual.",
      example:
        "Prevista para 14/11 com janela de ±2 dias → aparece como atrasada a partir de 17/11.",
    },
    {
      // domain/recommendations/prescription-calc.ts
      name: "Receita de aplicação (calda e tanques)",
      expressions: [
        "Calda total = vazão (L/ha) × área (ha)",
        "Nº de tanques = calda total ÷ capacidade do tanque",
        "Hectares por tanque = capacidade do tanque ÷ vazão",
        "Produto por tanque = dose (por ha) × capacidade ÷ vazão",
        "Produto total = dose (por ha) × área",
      ],
      description:
        "As contas usam os valores completos; o arredondamento acontece só na exibição. O último tanque leva o que sobra da calda depois dos tanques cheios.",
      example:
        "120 L/ha em 35 ha → 4.200 L de calda. Com tanque de 2.000 L: 2,1 tanques (2 cheios + 1 de 200 L). Dose de 0,5 L/ha → 8,333 L por tanque e 17,5 L no total.",
    },
    {
      // domain/purchase-list/breakdown.ts
      name: "Preço em dólar",
      expressions: ["Preço (R$) = preço (US$) × cotação do dólar"],
      description:
        "Usado quando o produto tem preço em dólar e há cotação informada; senão vale o preço em reais.",
      example: "US$ 12,00 com dólar a R$ 5,40 → R$ 64,80.",
    },
    {
      // domain/purchase-list/breakdown.ts e domain/cost-plan/calculate.ts
      name: "Custo em sacas",
      expressions: [
        "Sacas = custo (R$) ÷ preço da saca (R$)",
        "sc/ha = sacas ÷ área (ha)",
      ],
      description:
        "Converte o custo em quantas sacas da cultura ele representa. Sementes usam o preço da saca da própria cultura. Quando falta o divisor, o resultado é 0.",
      example: "R$ 55.000 com a saca a R$ 110 → 500 sacas; em 100 ha → 5 sc/ha.",
    },
  ];
}

// ---------------------------------------------------------------------------
// Glossário
// ---------------------------------------------------------------------------

const GLOSSARY: HelpGlossaryTerm[] = [
  {
    term: "Safra (da fazenda)",
    definition:
      "A temporada que agrupa a programação de cada talhão. Pode envolver mais de uma fazenda e mais de uma cultura. Status: Ativa, Colhida ou Removida.",
  },
  {
    term: "Programação do talhão",
    definition:
      "O cronograma de etapas de um talhão dentro da safra. Status: Rascunho, Publicada, Em andamento, Concluída, Colhida ou Removida.",
  },
  {
    term: "Talhão",
    definition:
      "Uma área da fazenda, medida em hectares, que recebe a sua própria programação.",
  },
  {
    term: "Etapa (recomendação)",
    definition:
      "Uma aplicação programada no cronograma, com produtos, dose, vazão, tanque e estádio. Status: Pendente, Atrasado, Aplicado no prazo, Aplicado com atraso ou Pulada.",
  },
  {
    term: "DAP",
    definition:
      "Dias após o plantio. É a régua do cronograma: cada etapa tem um dia-alvo em DAP.",
  },
  {
    term: "Janela de aplicação",
    definition:
      "O intervalo aceitável para aplicar uma etapa: o dia-alvo com 2 dias de tolerância para cada lado.",
  },
  {
    term: "Estádio fenológico",
    definition:
      "A fase de desenvolvimento da planta. O sistema sugere o estádio a partir do DAP, com tabelas médias por cultura, e o agrônomo pode corrigir.",
  },
  {
    term: "Vazão e calda",
    definition:
      "Vazão é quantos litros de calda vão por hectare (L/ha). Calda é a mistura de água e produtos que vai no tanque do pulverizador.",
  },
  {
    term: "Ordem de mistura",
    definition:
      "A ordem em que os produtos entram no tanque, definida pelo tipo de formulação. Pode ser ajustada.",
  },
  {
    term: "Modelo de timing",
    definition:
      "Um modelo reutilizável de etapas — dias, produtos e mistura de cada etapa — que pode ser aplicado à programação de um talhão.",
  },
  {
    term: "Lista de compra",
    definition:
      "Os insumos da safra e quanto comprar de cada um: o necessário, menos o que já foi aplicado e o que há em estoque. Status: Rascunho ou Finalizada.",
  },
  {
    term: "Template de compra",
    definition:
      "Uma lista de compra reutilizável, sem produtor nem talhões, usada como ponto de partida para a lista de um produtor.",
  },
  {
    term: "Cotação",
    definition:
      "O pedido de preço enviado às lojas por link, com condição à vista, a prazo ou barter. A palavra também aparece para a cotação do dólar e da saca.",
  },
  {
    term: "Plano de custo",
    definition:
      "O custo da safra por produto, por hectare e em sacas da cultura.",
  },
  {
    term: "Estoque (galpão)",
    definition:
      "O produto que o produtor já tem guardado. Reduz o quanto falta comprar, mas não o custo por hectare da lavoura.",
  },
  {
    term: "Carteira e gestão",
    definition:
      "Carteira é o conjunto de produtores de um agrônomo. Gestão é a carteira de outro agrônomo em que você atua como gestor ou consultor.",
  },
  {
    term: "Lico",
    definition:
      "O assistente do Recomenda no WhatsApp. Analisa fotos de pragas e doenças e avisa quando um produtor quer falar com você.",
  },
];

export function glossary(): HelpGlossaryTerm[] {
  return GLOSSARY;
}

// ---------------------------------------------------------------------------
// Perguntas frequentes
// ---------------------------------------------------------------------------

export function generalFaq(ctx: HelpContext): HelpFaqItem[] {
  const tourAgain: HelpFaqItem = {
    question: "Como vejo o tour de novo?",
    answer:
      "Abra a ajuda pelo botão de interrogação no topo e escolha um dos tours. Você pode refazer quantas vezes quiser.",
  };
  const menus: HelpFaqItem = {
    question: "Por que não vejo um item do menu?",
    answer:
      "Os menus dependem do seu papel e do seu nível de acesso. Um operador de fazenda, por exemplo, vê só o início e o cronograma.",
  };
  const bell: HelpFaqItem = {
    question: "O que é o ponto vermelho no sino?",
    answer:
      "Há notificações não lidas. Clique numa delas para ir à tela relacionada; ela é marcada como lida.",
  };

  if (ctx.shell === "admin") return [bell, tourAgain];

  return [
    {
      question: "Como volto para a tela anterior?",
      answer:
        "Clique num nível da trilha no topo da tela. No celular, use a seta ao lado do título.",
    },
    ...(ctx.canSearchProducers
      ? [
          {
            question: "Como encontro um produtor rapidamente?",
            answer:
              "Use a busca do topo ou o atalho ⌘K (Ctrl+K). Ela procura pelo nome e pelo e-mail.",
          },
        ]
      : []),
    {
      question: "Por que uma etapa aparece como “Atrasado”?",
      answer:
        "A etapa ainda está pendente e hoje já passou do fim da janela de aplicação — na janela padrão, a data prevista + 2 dias. Dessecação nunca fica atrasada sozinha: é sempre manual.",
    },
    ...(ctx.hasMultipleScopes
      ? [
          {
            question: "Estou na carteira de outro agrônomo. Como volto para a minha?",
            answer:
              "Use “Sair desta carteira” na faixa verde do topo, ou escolha “Minha carteira” no seletor de carteira.",
          },
        ]
      : []),
    menus,
    bell,
    tourAgain,
  ];
}

// ---------------------------------------------------------------------------
// Atalhos de teclado
// ---------------------------------------------------------------------------

export function shortcuts(ctx: HelpContext): HelpShortcut[] {
  const list: HelpShortcut[] = [];
  if (ctx.shell === "admin") {
    list.push({ keys: ["⌘", "B"], description: "Recolher ou expandir o menu lateral" });
  }
  if (ctx.shell === "agronomist" && ctx.canSearchProducers) {
    list.push(
      { keys: ["⌘", "K"], description: "Buscar produtor" },
      { keys: ["↑", "↓"], description: "Percorrer os resultados da busca" },
      { keys: ["Enter"], description: "Abrir o produtor escolhido na busca" },
    );
  }
  list.push({ keys: ["Esc"], description: "Fechar janelas, menus e o tour" });
  return list;
}
