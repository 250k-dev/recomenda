import type {
  HelpFaqItem,
  HelpFormula,
  HelpTourStep,
  PageHelp,
} from "../types";

/*
 * Ajuda da lista de compra — a lista da safra (visualização e edição) e o
 * assistente que monta a lista. As contas citam o arquivo de origem em
 * `packages/domain` (ou o componente, quando a regra mora na tela); ao mudar a
 * regra lá, atualize o texto aqui.
 *
 * Alvos `data-tour` desta tela:
 *   lista-*            → farm-purchase-list-tab, purchase-list-items-editor,
 *                        fulfill-without-quote-dialog, plan-surplus-notice
 *   lista-assistente-* → purchase-list-wizard
 */

// ---------------------------------------------------------------------------
// Passos de tour compartilhados (a tabela é a mesma na lista e no assistente)
// ---------------------------------------------------------------------------

const TOUR_TABS: HelpTourStep = {
  target: "lista-abas",
  title: "Tabelas da lista",
  content:
    "Sementes e Defensivos e fertilizantes ficam em abas separadas. Quando houver, aparecem também Fora da programação (produtos das etapas que não estavam na lista) e Removidos. O alerta âmbar conta os itens que o estoque não cobre.",
};

const TOUR_TABLE: HelpTourStep = {
  target: "lista-tabela",
  title: "Itens",
  content:
    "Clique no título de uma coluna para ordenar ou filtrar. As colunas em laranja resumem a compra — Falta comprar, Total e Total US$ — e o rodapé soma só o que o filtro deixou à vista.",
  placement: "top",
};

const TOUR_ADD: HelpTourStep = {
  target: "lista-adicionar",
  title: "Adicionar produtos",
  content:
    "A barra do rodapé inclui produtos e sementes. Escolha a categoria antes do produto. Para tirar vários de uma vez, marque as linhas na tabela.",
  placement: "top",
};

// ---------------------------------------------------------------------------
// Fórmulas (iguais nas duas telas)
// ---------------------------------------------------------------------------

const FORMULAS: HelpFormula[] = [
  {
    // domain/purchase-list/list-item.ts — areaFactorOf, treatedHectaresOf, listItemRequired
    name: "Volume de defensivos e fertilizantes",
    expressions: [
      "Hectares da linha = % área × hectares da lista",
      "Volume = dose × hectares da linha × nº de aplicações",
    ],
    description:
      "% área vazia vale 100%. O nº de aplicações é um número inteiro; vazio conta como 1.",
    example: "Dose de 0,5 L/ha, 50% de 200 ha, 2 aplicações → 0,5 × 100 × 2 = 100 L.",
  },
  {
    // domain/purchase-list/list-item.ts — doseFromCommercialVolume
    name: "Volume digitado à mão",
    expressions: ["Dose = volume ÷ (hectares da linha × nº de aplicações)"],
    description:
      "Quando o produto só é vendido em embalagem fechada, digite o volume comercial e a dose se ajusta. Mudar a dose ou a % área volta a calcular o volume pela dose.",
    example: "120 L em 100 ha com 2 aplicações → dose de 0,6 L/ha.",
  },
  {
    // domain/purchase-list/list-item.ts — populationFromSeeds, areaFromBags, seedsPerUnit
    name: "Sementes",
    expressions: [
      "População final = semente/metro × 10.000 ÷ espaçamento",
      "Área plantada = volume × sementes por unidade ÷ população final",
    ],
    description: (
      <>
        Você informa a semente/metro e o volume; a população e a área plantada
        saem das contas. Sementes por unidade: Big Bag de soja = 5.000.000; saco
        de milho = 60.000; feijão é em kg, com 1.000.000 ÷ PMS sementes por kg
        (PMS de 250 g se ficar vazio). Bag e saco só em números inteiros. O
        espaçamento padrão é 0,65 m.
      </>
    ),
    example:
      "13 sementes/m com espaçamento de 0,5 m → 260.000 plantas/ha. 6 Big Bags → 6 × 5.000.000 ÷ 260.000 ≈ 115,4 ha plantados.",
  },
  {
    // domain/purchase-list/list-item.ts — listItemsToBuyByKey
    name: "Falta comprar",
    expressions: ["Falta comprar = volume − já aplicado − estoque  (nunca negativo)"],
    description:
      "O estoque do galpão é descontado uma vez por produto, na ordem das linhas: se o mesmo produto aparece em duas linhas, o estoque cobre a primeira e só o que sobrar vai para a segunda.",
    example:
      "Estoque de 100 L e duas linhas do mesmo produto, de 80 L e 40 L → falta comprar 0 L na primeira e 20 L na segunda.",
  },
  {
    // purchase-list-items-editor.tsx — unitBrl, unitUsd, colunas totalBrl/totalUsd
    name: "Preço e total da linha",
    expressions: [
      "Valor (R$) = preço US$ × cotação do dólar",
      "Total = falta comprar × valor",
      "Total US$ = falta comprar × preço US$",
    ],
    description:
      "Sem preço em dólar, o Valor é o preço em reais digitado. Sem preço em dólar mas com cotação, o Total US$ converte o preço em reais pela cotação.",
    example: "Falta comprar 20 L a US$ 12,00 com dólar a R$ 5,40 → Valor R$ 64,80 e Total R$ 1.296,00.",
  },
  {
    // domain/purchase-list/breakdown.ts — computePurchaseListMetrics
    name: "Resumo do topo",
    expressions: [
      "Valor total = soma de (volume × valor) de todas as linhas",
      "Volume de sacas = soma de (volume × valor ÷ preço da saca)",
      "Custo (sc/ha) = volume de sacas ÷ hectares",
    ],
    description: (
      <>
        O resumo mede o custo da lavoura, por isso usa o volume programado e{" "}
        <strong>não desconta estoque nem o que já foi aplicado</strong> — ao
        contrário da coluna Total, que é o que ainda falta pagar. Sementes usam
        o preço da saca da própria cultura. Sem preço da saca informado, as
        contas usam R$ 110.
      </>
    ),
    example:
      "R$ 55.000 de produtos com a saca a R$ 110 → 500 sacas; em 100 ha → 5 sc/ha.",
  },
  {
    // components/domain/category-meta-progress.tsx, category-distribution-panel
    name: "Meta e categorias",
    expressions: [
      "Realizado (sc/ha) = Custo (sc/ha) da lista",
      "Sacas totais da meta = meta (sc/ha) × hectares",
      "% da categoria = valor da categoria ÷ valor total × 100",
    ],
    description:
      "A barra da meta fica vermelha quando o realizado passa da meta.",
    example: "Meta de 45 sc/ha em 200 ha → 9.000 sacas no total.",
  },
  {
    // purchase-list-items-editor.tsx — seedAreaRows
    name: "Área plantada × área da safra",
    expressions: ["Ocupação = área plantada da categoria ÷ hectares da safra × 100"],
    description:
      "Aparece no rodapé da tabela de sementes, por categoria. A partir de 90% avisa que está quase atingindo a área; acima de 100%, mostra quantos hectares passaram.",
  },
];

// ---------------------------------------------------------------------------
// Perguntas frequentes
// ---------------------------------------------------------------------------

const FAQ_ONE_LIST: HelpFaqItem = {
  question: "Posso ter duas listas na mesma safra?",
  answer:
    "Não. Cada safra tem uma lista de compra — e um rascunho já ocupa essa vaga. Ao abrir a lista de uma safra com rascunho, você continua de onde parou.",
};

const FAQ_TYPED_VOLUME: HelpFaqItem = {
  question: "Por que a dose mudou quando digitei o volume?",
  answer:
    "Volume digitado é tratado como a embalagem comercial que você vai comprar; a dose passa a ser o volume dividido pelos hectares da linha e pelo nº de aplicações. Mude a dose de novo para voltar ao cálculo pela dose.",
};

const VIEW_FAQ: HelpFaqItem[] = [
  {
    question: "Por que o Valor total é diferente do Total R$?",
    answer:
      "Medem coisas diferentes. O Valor total é o custo da lavoura: volume programado × preço, sem descontar estoque nem o já aplicado. O Total R$ (ao lado do dólar) e a coluna Total da tabela são o que ainda falta pagar: falta comprar × preço.",
  },
  {
    question: "Um produto tem estoque, mas o Falta comprar não diminuiu nessa linha. Por quê?",
    answer:
      "O estoque é descontado uma vez por produto, na ordem das linhas. Se o mesmo produto aparece antes, ele pode ter usado o estoque todo.",
  },
  {
    question: "Por que um produto apareceu em “Fora da programação”?",
    answer:
      "Ele é usado nas etapas do cronograma, mas não estava na lista. Entra ali para o custo não sumir: complete preço e estoque, ou remova.",
  },
  {
    question: "Não consigo mudar o dólar, a saca nem o espaçamento.",
    answer:
      "Esses campos só ficam editáveis com a lista em edição. Clique em “Editar Lista de Compras”.",
  },
  {
    question: "O que acontece se eu diminuir o estoque na tabela?",
    answer:
      "Ao salvar, o sistema pede confirmação para baixar o produto do galpão. O que outras safras já reservaram continua lá.",
  },
  {
    question: "Comprei sem cotar pelo sistema. Como registro?",
    answer:
      "Use “Registrar sem cotação”: o estoque é preenchido com o que falta comprar. Se quiser, informe o total gasto — sem preço por produto, é ele que vira o valor, as sacas e o sc/ha da lista.",
  },
  {
    question: "Removi um produto e ele foi parar em “Removidos”.",
    answer:
      "O que já tinha sido aplicado fica registrado ali, travado, para não perder a contabilidade do que foi para o campo. Não entra no custo nem na compra; se o produto voltar à lista ou a uma etapa, sai de lá.",
  },
  FAQ_ONE_LIST,
  FAQ_TYPED_VOLUME,
];

const WIZARD_FAQ: HelpFaqItem[] = [
  {
    question: "Fechei a aba sem querer. Perdi o que fiz?",
    answer:
      "Não. Enquanto você monta, o progresso fica guardado neste navegador e volta quando você reabre a tela. Para continuar em outro aparelho, use “Rascunho”.",
  },
  {
    question: "Importar um template apaga o que já adicionei?",
    answer:
      "Trocar de template substitui os produtos da lista pelos do template escolhido. Depois é só ajustar.",
  },
  {
    question: "Preciso definir uma meta?",
    answer:
      "Não, é opcional. Se definir, você acompanha o custo da lista contra a meta enquanto monta e pode mudá-la depois na própria lista.",
  },
  {
    question: "Por que não consigo avançar do passo dos produtos?",
    answer:
      "A lista precisa de nome e de pelo menos um produto, com categoria, produto e dose em todas as linhas. Sementes precisam de semente/metro e do volume (bag/saco inteiros; feijão em kg).",
  },
  FAQ_ONE_LIST,
  FAQ_TYPED_VOLUME,
];

// ---------------------------------------------------------------------------
// Telas
// ---------------------------------------------------------------------------

/** Lista da safra — visualização e edição (também a visão só-leitura). */
export const listaDeCompraHelp: Omit<PageHelp, "title"> = {
  summary:
    "Tudo o que a safra vai precisar — sementes, defensivos e fertilizantes —, quanto já existe em estoque e quanto falta comprar.",
  tour: [
    {
      target: null,
      title: "Lista de compra",
      content:
        "Aqui ficam os insumos da safra, o que já existe em estoque e o que falta comprar. Vamos passar pelas partes da tela.",
    },
    {
      target: "lista-resumo",
      title: "Resumo da lista",
      content:
        "Valor total, volume em sacas e custo por hectare, além de produtos, hectares e talhões. O valor total é o custo da lavoura: não desconta o que já está em estoque.",
    },
    {
      target: "lista-registrar-sem-cotacao",
      title: "Registrar sem cotação",
      content:
        "Para compras feitas fora do sistema: preenche o estoque com o que falta comprar e, se você quiser, guarda o total gasto.",
    },
    {
      target: "lista-exportar",
      title: "Exportar",
      content:
        "Envie a lista pelo WhatsApp, copie o texto ou gere um PDF para o produtor.",
    },
    {
      target: "lista-cotacoes",
      title: "Cotações",
      content: "Peça preço às lojas por link e compare as respostas.",
    },
    {
      target: "lista-estoque",
      title: "Estoque",
      content:
        "O galpão do produtor. O que está em estoque reduz o Falta comprar da tabela.",
    },
    {
      target: "lista-parametros",
      title: "Dólar, saca e espaçamento",
      content:
        "Alimentam as contas da tabela: o dólar converte preços em US$, a saca transforma custo em sacas e o espaçamento calcula a população das sementes. Mudam só com a lista em edição. À direita, o total que ainda falta comprar, em R$ e US$.",
    },
    {
      target: "lista-metas",
      title: "Metas e gastos por categoria",
      content:
        "Defina a meta de custo em sacas por hectare e acompanhe o realizado. Abaixo, quanto cada categoria pesa no total.",
    },
    {
      target: "lista-sobra",
      title: "Produtos acima do uso",
      content:
        "Produtos programados acima do que as etapas usam. A diferença fica reservada e entra no Falta comprar — ajuste se o produto foi trocado.",
    },
    TOUR_TABS,
    TOUR_TABLE,
    {
      target: "lista-editar",
      title: "Editar a lista",
      content:
        "Abre a tabela para mudar doses, áreas, estoque e preços. Enquanto você edita, as alterações são salvas sozinhas alguns segundos depois de cada mudança.",
      placement: "left",
    },
    {
      target: "lista-salvar",
      title: "Salvar ou cancelar",
      content:
        "Salvar grava tudo agora. Cancelar descarta o que mudou desde que você abriu a edição.",
      placement: "left",
    },
    TOUR_ADD,
  ],
  docs: [
    {
      title: "Para que serve",
      body: (
        <>
          <p>
            A lista reúne tudo o que a safra vai precisar de insumos — soja e
            milho juntos, se a safra tiver as duas culturas. Cada safra tem uma
            lista só.
          </p>
          <p>
            As quantidades saem das contas da tabela (dose × hectares ×
            aplicações, ou população para sementes); o que já está no galpão e o
            que já foi aplicado são descontados no Falta comprar.
          </p>
        </>
      ),
    },
    {
      title: "Resumo do topo",
      body: (
        <>
          <p>
            Valor total, Volume de sacas e Custo (sc/ha) medem o custo da
            lavoura: volume programado × preço, sem descontar o estoque.
          </p>
          <p>
            Já o Total R$ e o Total US$, ao lado do dólar e da saca, são o que
            ainda falta pagar: a soma da coluna Total da tabela (falta comprar ×
            preço). A diferença entre os dois é, sobretudo, o que já está no
            galpão.
          </p>
          <p>
            Lista registrada sem preço por produto mostra “Total gasto
            (informado)”, quando o total foi digitado no registro.
          </p>
        </>
      ),
    },
    {
      title: "Dólar, saca e espaçamento",
      body: (
        <p>
          A cotação do dólar converte os preços em US$ para reais — ela começa
          com a cotação do dia até você digitar outro valor. O preço da saca
          transforma o custo em sacas (safra com mais de uma cultura tem um preço
          para cada). O espaçamento entre linhas calcula a população das
          sementes. Os três só podem ser alterados com a lista em edição.
        </p>
      ),
    },
    {
      title: "As tabelas",
      body: (
        <>
          <p>
            <strong>Sementes</strong>: semente/metro, ciclo, população final,
            volume (bag/saco/kg) e área plantada. <strong>Defensivos e
            fertilizantes</strong>: formulação, dose, unidade, nº de aplicações,
            volume, % da área e uma observação de onde aplicar.
          </p>
          <p>
            Nas duas, à direita: estoque disponível, preço em US$, valor em R$ e,
            em laranja, Falta comprar, Total e Total US$. Cada coluna ordena e
            filtra pelo título; com filtro ativo, o rodapé soma só o que ficou à
            vista.
          </p>
          <p>
            <strong>Fora da programação</strong> reúne produtos usados nas etapas
            do cronograma que não estavam na lista. <strong>Removidos</strong>{" "}
            guarda, travados, os produtos tirados da lista depois de aplicados.
          </p>
        </>
      ),
    },
    {
      title: "Editar e salvar",
      body: (
        <>
          <p>
            “Editar Lista de Compras” libera a tabela e os parâmetros. Durante a
            edição, as mudanças são salvas sozinhas alguns segundos depois de
            cada alteração, e uma cópia fica no navegador caso a conexão falhe —
            se isso acontecer, a tela oferece recuperar o que não foi salvo.
          </p>
          <p>
            Se a mesma lista estiver aberta para edição em outra aba, a tela
            avisa: editar nas duas ao mesmo tempo pode sobrescrever alterações.
          </p>
          <p>
            Diminuir o estoque de um produto pede confirmação ao salvar, porque
            baixa o produto do galpão.
          </p>
          <p>
            Para remover, marque as linhas e use o botão vermelho do rodapé. Antes
            de confirmar, a tela mostra o que muda na safra: o produto sai também
            das etapas pendentes; o que estava reservado no galpão volta como
            devolução; e o que já foi aplicado continua registrado, na aba
            Removidos.
          </p>
        </>
      ),
    },
    {
      title: "Metas e categorias",
      body: (
        <p>
          A meta é o custo desejado em sacas por hectare. A barra compara o
          realizado (o Custo sc/ha da lista) com a meta e fica vermelha quando
          passa. Gastos por categoria mostram quanto cada categoria pesa no
          valor e em sc/ha.
        </p>
      ),
    },
    {
      title: "Exportar, cotar e registrar a compra",
      body: (
        <p>
          Exportar envia a lista pelo WhatsApp ou gera um PDF. Cotações pede
          preço às lojas por link. Para compras feitas fora do sistema,
          “Registrar sem cotação” preenche o estoque com o que falta comprar. O
          ícone de template salva os produtos para reaproveitar em outras safras.
        </p>
      ),
    },
  ],
  formulas: FORMULAS,
  faq: VIEW_FAQ,
};

/** Assistente que monta (ou retoma o rascunho de) a lista da safra. */
export const montarListaDeCompraHelp: Omit<PageHelp, "title"> = {
  summary:
    "Monte a lista da safra em três passos: meta (opcional), produtos e revisão.",
  tour: [
    {
      target: null,
      title: "Montar a lista de compra",
      content:
        "Três passos: meta, produtos e revisão. Enquanto você monta, o progresso fica guardado neste navegador.",
    },
    {
      target: "lista-assistente-progresso",
      title: "Em que passo você está",
      content:
        "Dá para voltar a qualquer passo sem perder o que já foi preenchido.",
    },
    {
      target: "lista-assistente-meta",
      title: "Meta de custo",
      content:
        "Opcional. Diga a meta em sacas por hectare; ao montar a lista você acompanha o realizado e recebe um aviso se passar.",
    },
    {
      target: "lista-assistente-identificacao",
      title: "Nome e cultura",
      content:
        "Dê um nome que identifique a safra. As culturas definem quais categorias de semente aparecem na tabela.",
    },
    {
      target: "lista-assistente-template",
      title: "Começar de um template",
      content:
        "Importe uma lista pronta e ajuste. Trocar de template substitui os produtos já incluídos.",
    },
    {
      target: "lista-assistente-meta-progresso",
      title: "Meta × realizado",
      content:
        "Conforme você adiciona produtos, a barra compara o custo da lista com a meta.",
    },
    {
      target: "lista-parametros",
      title: "Dólar, saca e espaçamento",
      content:
        "Alimentam as contas da tabela: o dólar converte preços em US$ (começa com a cotação do dia), a saca transforma custo em sacas — vazia, vale R$ 110 — e o espaçamento calcula a população das sementes. Ao lado, o total que falta comprar.",
    },
    TOUR_TABS,
    TOUR_TABLE,
    TOUR_ADD,
    {
      target: "lista-assistente-rascunho",
      title: "Rascunho",
      content:
        "Grava a lista como rascunho e volta para a safra. Ao abrir a lista de novo, você continua de onde parou.",
      placement: "top",
    },
    {
      target: "lista-assistente-proximo",
      title: "Próximo passo",
      content:
        "Confere o nome e os itens antes de avançar para a revisão.",
      placement: "top",
    },
    {
      target: "lista-assistente-revisao",
      title: "Revisão",
      content:
        "Confira produtor, talhões, área e quanto comprar de cada produto antes de salvar.",
    },
    {
      target: "lista-assistente-salvar-template",
      title: "Reaproveitar esta lista",
      content: "Salve os produtos como template para importar em outras safras.",
    },
    {
      target: "lista-assistente-salvar",
      title: "Salvar lista",
      content:
        "Finaliza a lista. Depois disso ela aparece na safra, pronta para editar, exportar e cotar.",
      placement: "top",
    },
  ],
  docs: [
    {
      title: "Os três passos",
      body: (
        <>
          <p>
            <strong>1. Meta</strong> — opcional: o custo desejado em sacas por
            hectare. <strong>2. Produtos</strong> — nome, culturas, template e a
            tabela de itens. <strong>3. Revisão</strong> — confira e salve.
          </p>
          <p>
            Voltar a um passo anterior não apaga nada do que foi preenchido.
          </p>
        </>
      ),
    },
    {
      title: "Rascunho e progresso",
      body: (
        <>
          <p>
            Enquanto você monta, o progresso é guardado neste navegador a cada
            alteração e volta se a aba fechar ou a página recarregar.
          </p>
          <p>
            “Rascunho” grava a lista no servidor como rascunho e volta para a
            safra. Cada safra tem uma lista só, e o rascunho ocupa essa vaga: ao
            abrir a lista da safra, o assistente reabre de onde parou.
          </p>
        </>
      ),
    },
    {
      title: "Templates",
      body: (
        <p>
          Um template é uma lista reutilizável, sem produtor nem talhões. Ao
          importar, as quantidades são recalculadas pelos hectares desta safra e
          o estoque do produtor é preenchido onde estiver vazio. Trocar de
          template substitui os produtos atuais. Na revisão, dá para salvar a
          lista montada como um template novo.
        </p>
      ),
    },
    {
      title: "Como as quantidades são calculadas",
      body: (
        <p>
          Defensivos e fertilizantes: dose × hectares da linha × nº de
          aplicações. Sementes: você informa semente/metro e o volume em
          bag/saco (ou kg, no feijão), e a área plantada é calculada a partir
          deles. Veja os detalhes em Fórmulas e cálculos.
        </p>
      ),
    },
    {
      title: "O que é conferido antes de avançar",
      body: (
        <p>
          A lista precisa de nome e de pelo menos um produto. Em cada linha:
          categoria, produto e dose. Sementes precisam de semente/metro e do
          volume — bag e saco em número inteiro. O nº de aplicações, quando
          preenchido, é um inteiro de 1 para cima.
        </p>
      ),
    },
  ],
  formulas: FORMULAS,
  faq: WIZARD_FAQ,
};
