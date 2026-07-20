import {
  createMixTemplate,
  replaceMixTemplateItems,
  updateTimingStage,
} from "@recomenda/api/templates";
import type { StageProductsPlan } from "@recomenda/domain/timing/sync-stage-products";

/**
 * Executa o plano decidido por `planStageProducts`. É só transporte: nenhuma
 * regra de negócio mora aqui — se uma condição precisar mudar, ela muda no
 * planejador, em `@recomenda/domain`.
 *
 * Fica em `apps/web`, e não em `api-hooks`, porque a invalidação de cache deste
 * fluxo é deliberadamente feita UMA vez ao fim do laço de etapas
 * (`timing-template-stages-panel.tsx:230-234`, com o comentário que explica o
 * bug de re-hidratação stale que o batch evita). Um hook de mutation por etapa
 * invalidaria no meio do laço e reintroduziria exatamente aquilo.
 *
 * @returns o id do mix da etapa depois de aplicado o plano, ou `null` se a etapa
 *          ficou sem mix.
 */
export async function applyStageProductsPlan(
  stageId: string,
  plan: StageProductsPlan,
): Promise<string | null> {
  if (plan.kind === "keep") {
    return plan.mixId;
  }

  if (plan.kind === "clear") {
    // Esvazia o mix (1 chamada) e desvincula do estágio.
    await replaceMixTemplateItems(plan.mixId, []);
    await updateTimingStage(stageId, { default_mix_template_id: null });
    return null;
  }

  let mixId = plan.mixId;
  if (!mixId) {
    const mix = await createMixTemplate({ name: plan.newMixName, crop: plan.crop });
    mixId = mix.id;
    await updateTimingStage(stageId, { default_mix_template_id: mixId });
  }

  await replaceMixTemplateItems(mixId, plan.items);

  return mixId;
}
