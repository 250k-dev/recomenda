import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computePrescription,
  fmtQuantity,
  fmtTankCount,
  productQuantities,
  sprayVolumeFromTotal,
  tankCapacityFromCount,
} from "./prescription-calc.ts";

const close = (actual: number | null, expected: number, digits = 6) => {
  assert.ok(actual != null, `esperava ${expected}, veio null`);
  assert.ok(Math.abs(actual - expected) < 10 ** -digits, `esperava ${expected}, veio ${actual}`);
};

describe("prescription-calc", () => {
  const base = computePrescription({ areaHa: 131.13, sprayVolumeLHa: 100, tankCapacityL: 3000 });

  it("calda e tanques do caso base (131,13 ha · 100 L/ha · 3.000 L)", () => {
    close(base.totalMixL, 13113);
    close(base.tankCount, 4.371);
    assert.equal(fmtTankCount(base.tankCount), "4,37");
    assert.equal(base.fullTanks, 4);
    close(base.lastTankL, 1113);
  });

  it("dose por ha", () => {
    const q = productQuantities(0.5, base, "HA");
    close(q.total, 65.565);
    close(q.perTank, 15);
    close(q.lastTank, 5.565);
  });

  it("dose por tanque", () => {
    const q = productQuantities(0.5, base, "PER_TANK");
    close(q.total, 2.1855);
    assert.equal(fmtQuantity(q.total), "2,186");
    close(q.perTank, 0.5);
    close(q.lastTank, 0.1855);
    assert.equal(fmtQuantity(q.lastTank), "0,186");
  });

  it("dose por 100 L com vazão 150", () => {
    const p = computePrescription({ areaHa: 131.13, sprayVolumeLHa: 150, tankCapacityL: 3000 });
    close(p.totalMixL, 19669.5);
    const q = productQuantities(0.5, p, "PER_100L");
    close(q.total, 98.3475);
    close(q.perTank, 15);
    close(q.lastTank, 8.3475);
  });

  it("contas inversas", () => {
    close(sprayVolumeFromTotal(13113, 131.13), 100);
    close(tankCapacityFromCount(5, 13113), 2622.6);
    close(sprayVolumeFromTotal("13113", 131.13), 100);
  });

  it("caso real: Zuconelli, 190 ha · 80 L/ha · tanque de 2.000 L", () => {
    const p = computePrescription({ areaHa: 190, sprayVolumeLHa: 80, tankCapacityL: 2000 });
    close(p.totalMixL, 15200);
    assert.equal(p.fullTanks, 7);
    close(p.lastTankL, 1200);
    close(p.haPerTank, 25);
    const verdict = productQuantities(0.0606, p);
    close(verdict.total, 11.514);
    close(verdict.perTank, 1.515);
    close(verdict.lastTank, 0.909);
  });

  it("% da área reduz só o total; a concentração no tanque é a mesma", () => {
    const p = computePrescription({ areaHa: 100, sprayVolumeLHa: 100, tankCapacityL: 2000 });
    const q = productQuantities(1, p, "HA", 0.2);
    close(q.total, 20);
    close(q.perTank, 20);
  });

  it("calda múltipla exata da capacidade: sem tanque parcial", () => {
    const p = computePrescription({ areaHa: 100, sprayVolumeLHa: 60, tankCapacityL: 2000 });
    assert.equal(p.fullTanks, 3);
    assert.equal(p.lastTankL, 0);
    assert.equal(productQuantities(1, p).lastTank, 0);
  });

  it("7,6 tanques não vira 7,5999 (ponto flutuante)", () => {
    const p = computePrescription({ areaHa: 190, sprayVolumeLHa: 80, tankCapacityL: 2000 });
    assert.equal(fmtTankCount(p.tankCount), "7,60");
  });

  it("entradas vazias ou zero: derivados nulos, nunca NaN/Infinity", () => {
    const empty = computePrescription({ areaHa: 0, sprayVolumeLHa: null, tankCapacityL: 0 });
    assert.equal(empty.totalMixL, null);
    assert.equal(empty.tankCount, null);
    assert.equal(empty.lastTankL, null);
    assert.equal(sprayVolumeFromTotal(100, 0), null);
    assert.equal(tankCapacityFromCount(0, 100), null);
    const noTank = computePrescription({ areaHa: 10, sprayVolumeLHa: 100 });
    close(noTank.totalMixL, 1000);
    assert.equal(noTank.tankCount, null);
    assert.deepEqual(productQuantities(1, noTank), { total: 10, perTank: null, lastTank: null });
    assert.deepEqual(productQuantities(null, base), { total: null, perTank: null, lastTank: null });
  });
});
