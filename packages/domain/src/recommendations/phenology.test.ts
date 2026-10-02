import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { suggestPhenologicalStage } from "./phenology.ts";

describe("phenology", () => {
  it("pré-plantio e plantio não dependem dos dias", () => {
    assert.deepEqual(suggestPhenologicalStage("SOYBEAN", "PRE_PLANTING", 18, 22), {
      stage: "Pré-semeadura",
      dapLabel: null,
    });
    assert.equal(suggestPhenologicalStage("CORN", "PLANTING", -2, 2).stage, "Semeadura");
  });

  it("soja: 18 DAP (janela 16–20) é V3–V4", () => {
    assert.deepEqual(suggestPhenologicalStage("SOYBEAN", "POST_PLANTING", 16, 20), {
      stage: "V3–V4",
      dapLabel: "16–20 DAP",
    });
  });

  it("soja: fungicida de 55 DAP é R3, dessecação de colheita é R7–R8", () => {
    assert.equal(suggestPhenologicalStage("SOYBEAN", "POST_PLANTING", 53, 57).stage, "R3");
    assert.equal(suggestPhenologicalStage("SOYBEAN", "POST_PLANTING", 103, 107).stage, "R7–R8");
  });

  it("milho e feijão têm tabela própria", () => {
    assert.equal(suggestPhenologicalStage("CORN", "POST_PLANTING", 28, 32).stage, "V6");
    assert.equal(suggestPhenologicalStage("BEAN", "POST_PLANTING", 38, 42).stage, "R6");
  });

  it("cultura desconhecida ou ANY usa a soja", () => {
    assert.equal(suggestPhenologicalStage("ANY", "POST_PLANTING", 16, 20).stage, "V3–V4");
    assert.equal(suggestPhenologicalStage(null, "POST_PLANTING", 16, 20).stage, "V3–V4");
  });
});
