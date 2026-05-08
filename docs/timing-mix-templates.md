# Timing Templates e Mix Templates

## O que foi feito

### Client (`lib/api/client.ts`)
Adicionados tipos e funções para os dois recursos:

**Timing Templates** — `getTimingTemplates`, `getTimingTemplate`, `createTimingTemplate`, `updateTimingTemplate`, `deleteTimingTemplate`, `createTimingStage`, `updateTimingStage`, `deleteTimingStage`, `reorderTimingStages`

**Mix Templates** — `getMixTemplates`, `getMixTemplate`, `createMixTemplate`, `updateMixTemplate`, `deleteMixTemplate`, `createMixTemplateItem`, `updateMixTemplateItem`, `deleteMixTemplateItem`

### Hooks (`lib/api/hooks.ts`)
Um hook por operação, todos invalidando as queries certas no `onSuccess`. Query keys adicionadas: `timingTemplates`, `timingTemplate(id)`, `mixTemplates`, `mixTemplate(id)`.

### Timing Templates — páginas

**`/timing-templates`** — lista com link para o editor, botão de arquivar e formulário inline para criar novo template (nome + cultura).

**`/timing-templates/[id]`** — editor completo:
- Renomear o template inline
- Lista de estágios ordenada por `order_index`
- Botões ▲/▼ para reordenar (chama `POST /timing_templates/:id/stages/reorder`)
- Editar cada estágio inline (nome, gatilho, janela início/fim em dias)
- Adicionar e remover estágios

### Mix Templates — páginas

**`/mix-templates`** — lista com link para o editor, botão de arquivar e formulário inline para criar novo template (nome + cultura).

**`/mix-templates/[id]`** — editor completo:
- Renomear o template inline
- Tabela de produtos com colunas: Produto, Dose/ha, Total para 100 ha (preview fixo)
- Editar dose inline por linha
- Adicionar produto via select do catálogo local + campo de dose
- Remover produto

## Endpoints utilizados

| Endpoint | Método | Uso |
|---|---|---|
| `/timing_templates` | GET / POST | Lista e criação |
| `/timing_templates/:id` | GET / PATCH / DELETE | Detalhe, edição e arquivamento |
| `/timing_templates/:id/stages` | POST | Adicionar estágio |
| `/timing_templates/:id/stages/reorder` | POST | Reordenar estágios |
| `/timing_stages/:id` | PATCH / DELETE | Editar e remover estágio |
| `/mix_templates` | GET / POST | Lista e criação |
| `/mix_templates/:id` | GET / PATCH / DELETE | Detalhe, edição e arquivamento |
| `/mix_templates/:id/items` | POST | Adicionar produto |
| `/mix_template_items/:id` | PATCH / DELETE | Editar dose e remover produto |

## Limitações conhecidas
- O preview de "total por área" usa valor fixo de 100 ha — não é calculado pela área real de um talhão.
- `product_name` e `dose_unit` nos itens de mix dependem do backend retornar esses campos no GET do template. Se o backend não os incluir no join, aparecerá o UUID do produto no lugar do nome.
