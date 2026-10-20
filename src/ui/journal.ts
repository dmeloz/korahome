import { ajouterEvenement, nettoyerDetail, type EvenementJournal, type TypeEvenement } from "../domaine/retours";
import { CLES, ecrireJson, lireJson } from "./stockageLocal";

// Journal discret des retours de test : propre à ce téléphone, hors du dépôt et
// jamais envoyé seul. Il note l'ouverture de l'app, les écrans visités, le
// libellé des boutons touchés et les erreurs ; jamais ce qui est tapé au clavier.

let memoire: EvenementJournal[] | null = null;
let ecriture: ReturnType<typeof setTimeout> | null = null;
let ecranCourant = () => "Accueil";

function charger(): EvenementJournal[] {
  if (memoire) return memoire;
  const brut = lireJson<unknown>(CLES.journal, []);
  memoire = Array.isArray(brut) ? brut : [];
  return memoire;
}

function vider() {
  if (ecriture) clearTimeout(ecriture);
  ecriture = null;
  // Stockage plein ou indisponible : le journal vaut pour cette visite.
  ecrireJson(CLES.journal, memoire ?? []);
}

export function lireJournal(): EvenementJournal[] {
  return [...charger()];
}

/** Ajoute un événement. Ne lève jamais : le journal ne doit pas gêner l'app. */
export function noter(type: TypeEvenement, detail: string, ecran = ecranCourant()): void {
  try {
    memoire = ajouterEvenement(charger(), { h: new Date().toISOString(), type, detail, ecran, version: __VERSION__ });
    // Écriture regroupée : un toucher ne réécrit pas tout le journal.
    ecriture ??= setTimeout(vider, 1000);
  } catch {
    // rien
  }
}

export function effacerJournal(): void {
  memoire = [];
  vider();
}

/** Le libellé lisible d'un élément touché : son aria-label, sinon son texte. */
function libelle(el: Element): string {
  const aria = el.getAttribute("aria-label");
  if (aria) return aria;
  if (el instanceof HTMLInputElement) return `${el.type} ${el.name || el.placeholder || ""}`.trim();
  // innerText sépare les blocs par des sauts de ligne : un widget se résume à son titre.
  const texte = (el instanceof HTMLElement ? el.innerText : el.textContent) ?? "";
  const premiere = texte.split("\n").find((l) => l.trim() !== "") ?? "";
  return nettoyerDetail(premiere, 60) || el.tagName.toLowerCase();
}

/** Branche le journal sur toute l'app ; à appeler une fois au démarrage. */
export function installerJournal(ecran: () => string): void {
  ecranCourant = ecran;
  noter("lancement", `Kora ${__VERSION__}`, "—");

  document.addEventListener(
    "click",
    (e) => {
      const cible = (e.target as Element | null)?.closest("button, a, [role=button], input[type=checkbox], input[type=date], select");
      if (cible && !cible.closest("[data-journal=non]")) noter("geste", libelle(cible));
    },
    { capture: true, passive: true },
  );
  window.addEventListener("error", (e) => noter("erreur", e.message || "Erreur inconnue"));
  window.addEventListener("unhandledrejection", (e) => noter("erreur", String(e.reason?.message ?? e.reason)));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") vider();
  });
}
