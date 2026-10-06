import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { currentDapLabel, dapLabel, dapOf, daysFromPlanting } from "./dap.ts";

describe("dap", () => {
  it("conta os dias a partir do plantio", () => {
    assert.equal(daysFromPlanting("2026-10-01", "2026-11-05"), 35);
    assert.equal(daysFromPlanting("2026-10-01", "2026-09-27"), -4);
    assert.equal(daysFromPlanting(null, "2026-11-05"), null);
  });

  it("antes do plantio não existe DAP negativo", () => {
    assert.equal(dapLabel(35), "35 DAP");
    assert.equal(dapLabel(0), "No plantio");
    assert.equal(dapLabel(-4), "4 dias antes do plantio");
    assert.equal(dapLabel(-1), "1 dia antes do plantio");
    assert.equal(dapOf("2026-10-01", "2026-11-05T12:00:00Z"), "35 DAP");
  });

  it("hoje: DAP ou quanto falta para o plantio", () => {
    const hoje = new Date(2026, 9, 5);
    assert.equal(currentDapLabel("2026-10-01", hoje), "4 DAP");
    assert.equal(currentDapLabel("2026-10-10", hoje), "Plantio em 5 dias");
    assert.equal(currentDapLabel(null, hoje), null);
  });
});
