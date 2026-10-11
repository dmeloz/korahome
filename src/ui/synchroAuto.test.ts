import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Synchro } from "../donnees/synchro";
import { DELAI_APRES_MODIFICATION, DELAI_TEMPS_REEL, INTERVALLE, planifierSynchro, synchroEnDirect, type Environnement } from "./synchroAuto";

function preparer() {
  const synchro = { demarrer: vi.fn(async () => {}), synchroniser: vi.fn(async () => {}) } as unknown as Synchro & {
    synchroniser: ReturnType<typeof vi.fn>;
  };
  const ecouteurs = new Map<string, () => void>();
  let visible = true;
  const env: Environnement = {
    visible: () => visible,
    ecouter: (e, r) => {
      ecouteurs.set(e, r);
      return () => ecouteurs.delete(e);
    },
  };
  let prevenir = () => {};
  let enAttente: unknown[] = [];
  const depot = {
    abonner: (r: () => void) => {
      prevenir = r;
      return () => {};
    },
    lireEnAttente: async () => enAttente,
  };
  const arreter = planifierSynchro(synchro, depot, env);
  return {
    synchro,
    ecouteurs,
    arreter,
    cacher: (v: boolean) => (visible = !v),
    modifier: (attente: unknown[]) => {
      enAttente = attente;
      prevenir();
    },
  };
}

describe("synchro automatique", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("synchronise à l'ouverture", async () => {
    const { synchro } = preparer();
    await vi.advanceTimersByTimeAsync(0);
    expect(synchro.synchroniser).toHaveBeenCalledTimes(1);
  });

  it("synchronise peu après une modification faite ici, une seule fois pour plusieurs gestes", async () => {
    const { synchro, modifier } = preparer();
    await vi.advanceTimersByTimeAsync(0);
    modifier([1]);
    modifier([1, 2]);
    await vi.advanceTimersByTimeAsync(DELAI_APRES_MODIFICATION);
    expect(synchro.synchroniser).toHaveBeenCalledTimes(2);
  });

  it("ne relance pas pour des modifications reçues de l'autre téléphone", async () => {
    const { synchro, modifier } = preparer();
    await vi.advanceTimersByTimeAsync(0);
    modifier([]);
    await vi.advanceTimersByTimeAsync(DELAI_APRES_MODIFICATION);
    expect(synchro.synchroniser).toHaveBeenCalledTimes(1);
  });

  it("synchronise régulièrement tant que l'app est à l'écran, et au retour dans l'app", async () => {
    const { synchro, cacher, ecouteurs } = preparer();
    await vi.advanceTimersByTimeAsync(INTERVALLE);
    expect(synchro.synchroniser).toHaveBeenCalledTimes(2);
    cacher(true);
    await vi.advanceTimersByTimeAsync(INTERVALLE * 3);
    expect(synchro.synchroniser).toHaveBeenCalledTimes(2);
    cacher(false);
    ecouteurs.get("visibilitychange")!();
    expect(synchro.synchroniser).toHaveBeenCalledTimes(3);
  });

  it("s'arrête proprement", async () => {
    const { synchro, arreter, ecouteurs } = preparer();
    await vi.advanceTimersByTimeAsync(0);
    arreter();
    await vi.advanceTimersByTimeAsync(INTERVALLE * 2);
    expect(synchro.synchroniser).toHaveBeenCalledTimes(1);
    expect(ecouteurs.size).toBe(0);
  });
});

describe("synchro en direct", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("un seul passage pour une rafale de changements signalés par le serveur", async () => {
    const synchro = { synchroniser: vi.fn(async () => {}) } as unknown as Synchro & { synchroniser: ReturnType<typeof vi.fn> };
    let signaler = () => {};
    const fermer = vi.fn();
    const arreter = synchroEnDirect(synchro, (r) => {
      signaler = r;
      return fermer;
    });
    signaler();
    signaler();
    signaler();
    await vi.advanceTimersByTimeAsync(DELAI_TEMPS_REEL);
    expect(synchro.synchroniser).toHaveBeenCalledTimes(1);
    signaler();
    arreter();
    await vi.advanceTimersByTimeAsync(DELAI_TEMPS_REEL);
    expect(synchro.synchroniser).toHaveBeenCalledTimes(1);
    expect(fermer).toHaveBeenCalled();
  });
});
