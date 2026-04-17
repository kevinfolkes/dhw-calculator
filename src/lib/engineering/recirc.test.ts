import { describe, it, expect } from "vitest";
import { recircStandbyLoss } from "./recirc";

describe("recircStandbyLoss", () => {
  it("zero loss when return temp equals ambient", () => {
    const r = recircStandbyLoss({ loopLengthFt: 1000, insulationR: 4, returnTempF: 70, ambientPipeF: 70 });
    expect(r.lossBTUH).toBe(0);
  });

  it("higher insulation reduces loss", () => {
    const bare = recircStandbyLoss({ loopLengthFt: 800, insulationR: 0, returnTempF: 125, ambientPipeF: 70 });
    const r4 = recircStandbyLoss({ loopLengthFt: 800, insulationR: 4, returnTempF: 125, ambientPipeF: 70 });
    const r8 = recircStandbyLoss({ loopLengthFt: 800, insulationR: 8, returnTempF: 125, ambientPipeF: 70 });
    expect(r4.lossBTUH).toBeLessThan(bare.lossBTUH);
    expect(r8.lossBTUH).toBeLessThan(r4.lossBTUH);
  });

  it("loss scales linearly with loop length", () => {
    const r1 = recircStandbyLoss({ loopLengthFt: 500, insulationR: 4, returnTempF: 125, ambientPipeF: 70 });
    const r2 = recircStandbyLoss({ loopLengthFt: 1000, insulationR: 4, returnTempF: 125, ambientPipeF: 70 });
    expect(r2.lossBTUH).toBeCloseTo(r1.lossBTUH * 2, 0);
  });

  it("kW matches BTU/hr conversion", () => {
    const r = recircStandbyLoss({ loopLengthFt: 800, insulationR: 4, returnTempF: 125, ambientPipeF: 70 });
    expect(r.lossKW).toBeCloseTo(r.lossBTUH / 3412, 3);
  });
});
