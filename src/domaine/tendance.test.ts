import { describe, expect, it } from "vitest";
import { dernieres, motDuSens, sensDe, traceDe } from "./tendance";

describe("la tendance dans les cartes", () => {
  it("dit si ça monte, descend ou reste", () => {
    expect(sensDe([3200, 3600, 4100])).toBe("hausse");
    expect(sensDe([4100, 3900, 3700])).toBe("baisse");
    expect(sensDe([3900, 3950, 3910])).toBe("stable");
    expect(sensDe([0, 0])).toBe("stable");
    expect(sensDe([42])).toBeNull();
    expect(motDuSens("hausse")).toBe("en hausse");
  });

  it("garde les dernières valeurs", () => {
    expect(dernieres([1, 2, 3, 4], 2)).toEqual([3, 4]);
  });

  it("trace entre le plus bas et le plus haut, à plat quand rien ne bouge", () => {
    expect(traceDe([0, 10], 100, 32)).toBe("M0.0,30.0 L100.0,2.0");
    expect(traceDe([5, 5], 100, 32)).toBe("M0.0,16.0 L100.0,16.0");
    expect(traceDe([], 100, 32)).toBe("M0,30 L100,30");
  });
});
