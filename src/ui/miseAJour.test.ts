import { describe, expect, it, vi } from "vitest";
import { creerMiseAJour, type Inscription, type OptionsEnregistrement } from "./miseAJour";

function preparer(inscription?: Partial<Inscription>) {
  let options: OptionsEnregistrement = {};
  const appliquerSW = vi.fn(async () => {});
  const maj = creerMiseAJour((o) => {
    options = o;
    return appliquerSW;
  });
  if (inscription) {
    options.onRegisteredSW?.("/sw.js", { update: async () => {}, installing: null, waiting: null, ...inscription });
  }
  return { maj, options, appliquerSW };
}

describe("mise à jour de l'app", () => {
  it("n'annonce rien tant qu'aucune nouvelle version n'est arrivée", () => {
    const { maj } = preparer();
    expect(maj.prete()).toBe(false);
  });

  it("prévient l'écran quand une nouvelle version est prête", () => {
    const { maj, options } = preparer();
    const ecouteur = vi.fn();
    maj.abonner(ecouteur);
    options.onNeedRefresh?.();
    expect(maj.prete()).toBe(true);
    expect(ecouteur).toHaveBeenCalledOnce();
  });

  it("applique la nouvelle version en rechargeant l'app", async () => {
    const { maj, appliquerSW } = preparer();
    await maj.appliquer();
    expect(appliquerSW).toHaveBeenCalledWith(true);
  });

  it("recharge une seule fois quand la nouvelle version prend la main", async () => {
    let quandChange = () => {};
    const recharger = vi.fn();
    const maj = creerMiseAJour(() => async () => {}, (r) => (quandChange = r), recharger);
    await maj.appliquer();
    quandChange();
    quandChange();
    expect(recharger).toHaveBeenCalledOnce();
  });

  it("dit que l'app est à jour quand le navigateur ne trouve rien", async () => {
    const { maj } = preparer({});
    expect(await maj.verifier()).toBe("a_jour");
  });

  it("dit qu'une version arrive quand le navigateur en télécharge une", async () => {
    const { maj } = preparer({ installing: {} });
    expect(await maj.verifier()).toBe("en_cours");
  });

  it("dit que la vérification est impossible sans service worker ou hors ligne", async () => {
    expect(await preparer().maj.verifier()).toBe("indisponible");
    const horsLigne = preparer({ update: async () => Promise.reject(new Error("réseau")) });
    expect(await horsLigne.maj.verifier()).toBe("indisponible");
  });
});
