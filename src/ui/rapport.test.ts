import { afterEach, describe, expect, it, vi } from "vitest";
import { envoyerAuMac } from "./rapport";

function repondre(statut: number, type: string) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: statut, headers: { "Content-Type": type } })));
}

describe("envoyerAuMac", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("dépose quand le Mac répond", async () => {
    repondre(200, "application/json; charset=utf-8");
    expect(await envoyerAuMac("# rapport")).toBe("depose");
  });

  it("ne croit pas l'hébergeur en ligne qui répond par la page de l'app", async () => {
    repondre(200, "text/html; charset=UTF-8");
    expect(await envoyerAuMac("# rapport")).toBe("injoignable");
  });

  it("signale un rapport refusé par le Mac", async () => {
    repondre(413, "application/json");
    expect(await envoyerAuMac("# rapport")).toBe("refuse");
  });

  it("signale un Mac éteint", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Load failed"))));
    expect(await envoyerAuMac("# rapport")).toBe("injoignable");
  });
});
