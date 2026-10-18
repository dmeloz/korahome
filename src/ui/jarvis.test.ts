import { afterEach, describe, expect, it, vi } from "vitest";
import type { Modification } from "../domaine/jarvis";
import { annulerModifications, DUREE_ECOUTE_MAX, ecouter, enregistrerModifications, phraseEntendue } from "./jarvis";

function depotEspion() {
  const appels: string[] = [];
  const noter = (nom: string) => async (x: unknown) => {
    appels.push(`${nom} ${Array.isArray(x) ? x.join(",") : typeof x === "string" ? x : (x as { id: string }).id}`);
  };
  return {
    appels,
    depot: {
      enregistrerElement: noter("element"),
      supprimerElements: noter("supprimer-elements"),
      enregistrerTache: noter("tache"),
      supprimerTache: noter("supprimer-tache"),
      enregistrerProduit: noter("produit"),
      supprimerProduit: noter("supprimer-produit"),
      enregistrerAnimal: noter("animal"),
      enregistrerZone: noter("zone"),
      enregistrerSouvenir: noter("souvenir"),
      supprimerSouvenir: noter("supprimer-souvenir"),
      enregistrerRetour: noter("retour"),
      supprimerRetour: noter("supprimer-retour"),
      enregistrerAgenda: noter("agenda"),
      supprimerAgenda: noter("supprimer-agenda"),
    },
  };
}

const doc = (id: string) => ({ id }) as never;

describe("Jarvis et le Dépôt", () => {
  const modifications: Modification[] = [
    { collection: "elements", avant: null, apres: doc("e1") },
    { collection: "taches", avant: doc("t1"), apres: doc("t1") },
    { collection: "stock", avant: null, apres: doc("p1") },
    { collection: "animaux", avant: doc("a1"), apres: doc("a1") },
    { collection: "jardin", avant: doc("z1"), apres: doc("z1") },
  ];

  it("enregistre chaque document modifié", async () => {
    const { depot, appels } = depotEspion();
    await enregistrerModifications(depot, modifications);
    expect(appels).toEqual(["element e1", "tache t1", "produit p1", "animal a1", "zone z1"]);
  });

  it("annule à l'envers : ce qui a été créé disparaît, le reste revient", async () => {
    const { depot, appels } = depotEspion();
    await annulerModifications(depot, modifications);
    expect(appels).toEqual(["zone z1", "animal a1", "supprimer-produit p1", "tache t1", "supprimer-elements e1"]);
  });

  it("supprime ce que Jarvis retire, et Annuler le remet", async () => {
    const suppressions: Modification[] = [
      { collection: "taches", avant: doc("t2"), apres: doc("t2"), supprime: true },
      { collection: "stock", avant: doc("p2"), apres: doc("p2"), supprime: true },
      { collection: "memoire", avant: doc("m1"), apres: doc("m1"), supprime: true },
      { collection: "memoire", avant: null, apres: doc("m2") },
      { collection: "retours", avant: null, apres: doc("r1") },
    ];
    const { depot, appels } = depotEspion();
    await enregistrerModifications(depot, suppressions);
    expect(appels).toEqual(["supprimer-tache t2", "supprimer-produit p2", "supprimer-souvenir m1", "souvenir m2", "retour r1"]);
    appels.length = 0;
    await annulerModifications(depot, suppressions);
    expect(appels).toEqual(["supprimer-retour r1", "supprimer-souvenir m2", "souvenir m1", "produit p2", "tache t2"]);
  });
});

describe("la voix", () => {
  afterEach(() => vi.unstubAllGlobals());

  /** Une fausse reconnaissance, pilotée par le test, et une minuterie qu'on avance à la main. */
  function installer(options: { demarrageRefuse?: boolean } = {}) {
    const ecoutes: { onresult: ((e: unknown) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null; arretee: boolean }[] = [];
    class FausseReconnaissance {
      lang = "";
      interimResults = false;
      continuous = false;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      arretee = false;
      start() {
        if (options.demarrageRefuse) throw new Error("InvalidStateError");
        ecoutes.push(this);
      }
      stop() {
        this.arretee = true;
      }
    }
    vi.stubGlobal("window", { webkitSpeechRecognition: FausseReconnaissance });
    const attentes: { f: () => void; ms: number; annulee: boolean }[] = [];
    const minuterie = {
      attendre: (f: () => void, ms: number) => {
        const a = { f, ms, annulee: false };
        attentes.push(a);
        return a;
      },
      annuler: (a: unknown) => {
        (a as { annulee: boolean }).annulee = true;
      },
    };
    const avancer = (ms: number) => attentes.filter((a) => !a.annulee && a.ms <= ms).forEach((a) => ((a.annulee = true), a.f()));
    const fins: [string, string | null][] = [];
    const entendu: string[] = [];
    const arreter = ecouter((t) => entendu.push(t), (t, e) => fins.push([t, e]), minuterie);
    const parler = (...morceaux: string[]) => ecoutes[0].onresult?.({ results: morceaux.map((m) => Object.assign([{ transcript: m }], { isFinal: false })) });
    return { ecoutes, fins, entendu, arreter, avancer, parler };
  }

  it("ne répète pas les morceaux que l'iPhone redit", () => {
    expect(phraseEntendue(["ajoute", "ajoute du lait"])).toBe("ajoute du lait");
    expect(phraseEntendue(["ajoute du lait", " et des œufs"])).toBe("ajoute du lait et des œufs");
    expect(phraseEntendue(["", "  "])).toBe("");
  });

  it("rend la phrase une seule fois quand l'écoute finit", () => {
    const v = installer();
    v.parler("ajoute", "ajoute du lait");
    expect(v.entendu).toEqual(["ajoute du lait"]);
    v.ecoutes[0].onend?.();
    v.ecoutes[0].onend?.();
    expect(v.fins).toEqual([["ajoute du lait", null]]);
  });

  it("finit même si l'iPhone ne prévient jamais", () => {
    const v = installer();
    v.parler("la litière est faite");
    v.avancer(DUREE_ECOUTE_MAX);
    expect(v.ecoutes[0].arretee).toBe(true);
    v.avancer(DUREE_ECOUTE_MAX);
    expect(v.fins).toEqual([["la litière est faite", null]]);
  });

  it("un toucher sur Arrêter rend ce qui a été entendu", () => {
    const v = installer();
    v.parler("ajoute des œufs");
    v.arreter();
    v.avancer(2000);
    expect(v.fins).toEqual([["ajoute des œufs", null]]);
  });

  it("explique un micro refusé ou qui ne démarre pas, sans planter", () => {
    const refuse = installer();
    refuse.ecoutes[0].onerror?.({ error: "service-not-allowed" });
    refuse.ecoutes[0].onend?.();
    expect(refuse.fins[0][1]).toMatch(/dictée du clavier/);

    const bloque = installer({ demarrageRefuse: true });
    expect(bloque.fins).toEqual([["", "Le micro n'a pas pu démarrer : utilise la dictée du clavier."]]);
  });
});
