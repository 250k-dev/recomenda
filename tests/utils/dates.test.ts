import { describe, expect, it } from "vitest";
import { formatDateBR } from "@/lib/utils/dates";

describe("formatDateBR", () => {
  it("formats dates in Sao Paulo timezone", () => {
    expect(formatDateBR("2026-05-01T12:00:00Z")).toBe("01/05/2026");
  });
});
