import { useEffect, useRef } from "react";
import { basculerCoeur, clinDuJour, DEMANDE_CLIN, elementsBandeau, infosUtiles, nouveauClin, type ElementBandeau } from "../domaine/bandeau";
import { decrireFoyer } from "../domaine/jarvis";
import type { Depot } from "../donnees/depot";
import type { ServeurJarvis } from "../donnees/distant";
import { vibrer } from "./haptique";
import { Icone } from "./Icone";
import type { DonneesModule } from "./modules";

// Le bandeau du couple, sous « Bonjour, Melo » : il défile doucement de droite à gauche,
// comme un fil d'infos, et se fait défiler au doigt pour relire un passage ; il repart seul
// peu après. Les mots de l'autre ressortent avec son prénom. Toucher un mot lui renvoie un
// cœur ; toucher ailleurs ouvre « Nos mots ».

const CLE_CLIN = "korahome.clinDemande";
/** Le temps de laisser la synchro apporter le clin d'œil déjà demandé par l'autre téléphone. */
const ATTENTE_CLIN_MS = 8000;
/** Le clin d'œil se demande à partir de 6 h. */
const HEURE_CLIN = 6;
/** Vitesse du défilement tout seul, en points par seconde. */
const VITESSE = 32;
/** Après un passage au doigt, le bandeau repart seul au bout de ce temps. */
const REPRISE_MS = 3500;

export function BandeauCouple(props: {
  donnees: DonneesModule;
  depot: Depot;
  jarvis: { serveur: ServeurJarvis; foyerId: string } | null;
  ouvrir: () => void;
}) {
  const { donnees, depot } = props;
  const maintenant = new Date().toISOString();
  const infos = infosUtiles({ meteo: donnees.meteo, taches: donnees.taches, produits: donnees.produits, animaux: donnees.animaux, aujourdhui: donnees.aujourdhui });
  const elements = elementsBandeau({ docs: donnees.couple, foyer: donnees.foyer, moi: donnees.membreId, maintenant, aujourdhui: donnees.aujourdhui, infos });
  useClinDuJour(props);
  const zone = useRef<HTMLDivElement>(null);
  const copie = useRef<HTMLSpanElement>(null);
  useDefilement(zone, copie, elements.length);

  if (!elements.length) {
    return (
      <button className="bandeau-couple vide" onClick={props.ouvrir}>
        <Icone nom="coeur" taille={15} />
        <span>Écrire un petit mot</span>
      </button>
    );
  }

  const coeur = async (e: React.MouseEvent, el: ElementBandeau) => {
    if (!el.mot || !donnees.membreId) return;
    e.stopPropagation();
    vibrer();
    await depot.enregistrerCouple(basculerCoeur(el.mot, donnees.membreId));
  };

  // Le fil est écrit deux fois : quand la première copie a fini de passer, la seconde est à sa place.
  const fil = (numero: number) =>
    elements.map((el) => {
      const aime = !!el.mot && !!donnees.membreId && el.mot.coeurs.includes(donnees.membreId);
      return (
        <span key={`${numero}-${el.cle}`} className={`bandeau-element genre-${el.genre}${aime ? " aime" : ""}`} onClick={el.mot ? (e) => void coeur(e, el) : undefined}>
          {el.genre === "mot" && <Icone nom="coeur" taille={13} />}
          {el.auteur && <b className="bandeau-auteur">{el.auteur}</b>}
          {el.texte}
        </span>
      );
    });

  return (
    <div
      className="bandeau-couple"
      role="button"
      tabIndex={0}
      aria-label={`Nos mots : ${elements.map((el) => (el.mot ? `${el.auteur} : ${el.mot.texte}` : el.texte)).join(". ")}`}
      onClick={props.ouvrir}
      onKeyDown={(e) => (e.key === "Enter" ? props.ouvrir() : undefined)}
      ref={zone}
    >
      <div className="bandeau-fil" aria-hidden>
        <span className="bandeau-copie" ref={copie}>{fil(1)}</span>
        <span className="bandeau-copie">{fil(2)}</span>
      </div>
    </div>
  );
}

/**
 * Le défilement : la zone se fait glisser au doigt comme une liste de l'iPhone ; sinon elle
 * avance seule d'un petit pas à chaque image. Arrivée au bout de la première copie, elle revient
 * d'une copie en arrière, ce qui ne se voit pas puisque les deux sont identiques.
 */
function useDefilement(zone: React.RefObject<HTMLDivElement | null>, copie: React.RefObject<HTMLSpanElement | null>, nombre: number) {
  useEffect(() => {
    const el = zone.current;
    if (!el || !nombre) return;
    const calme = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let position = el.scrollLeft;
    let touche = false;
    let repriseA = 0;
    let avant = 0;
    let image = 0;

    const largeur = () => copie.current?.offsetWidth ?? 0;
    const boucler = () => {
      const l = largeur();
      if (l <= 0) return;
      if (el.scrollLeft >= l) el.scrollLeft -= l;
      else if (el.scrollLeft <= 0 && !calme) el.scrollLeft += l;
      position = el.scrollLeft;
    };
    const pause = () => {
      repriseA = performance.now() + REPRISE_MS;
    };
    const debut = () => {
      touche = true;
      pause();
    };
    const fin = () => {
      touche = false;
      pause();
    };
    // Un défilement qui n'est pas le nôtre vient du doigt (ou de son élan) : on attend qu'il se pose.
    const defile = () => {
      if (Math.abs(el.scrollLeft - position) > 2) {
        position = el.scrollLeft;
        pause();
      }
    };
    const avancer = (t: number) => {
      const dt = avant ? Math.min(t - avant, 64) : 0;
      avant = t;
      if (!touche && t >= repriseA && !document.hidden) {
        if (repriseA) {
          boucler();
          repriseA = 0;
        }
        position += (VITESSE * dt) / 1000;
        const l = largeur();
        if (l > 0 && position >= l) position -= l;
        el.scrollLeft = position;
      }
      image = requestAnimationFrame(avancer);
    };

    el.addEventListener("touchstart", debut, { passive: true });
    el.addEventListener("touchend", fin, { passive: true });
    el.addEventListener("touchcancel", fin, { passive: true });
    el.addEventListener("pointerdown", debut);
    el.addEventListener("pointerup", fin);
    el.addEventListener("wheel", pause, { passive: true });
    el.addEventListener("scroll", defile, { passive: true });
    if (!calme) image = requestAnimationFrame(avancer);
    return () => {
      cancelAnimationFrame(image);
      el.removeEventListener("touchstart", debut);
      el.removeEventListener("touchend", fin);
      el.removeEventListener("touchcancel", fin);
      el.removeEventListener("pointerdown", debut);
      el.removeEventListener("pointerup", fin);
      el.removeEventListener("wheel", pause);
      el.removeEventListener("scroll", defile);
    };
  }, [zone, copie, nombre]);
}

/** Une fois par jour, Jarvis écrit le clin d'œil du foyer ; le premier téléphone ouvert s'en charge. */
function useClinDuJour(props: { donnees: DonneesModule; depot: Depot; jarvis: { serveur: ServeurJarvis; foyerId: string } | null }) {
  const { donnees, depot, jarvis } = props;
  const dejaLa = !!clinDuJour(donnees.couple, donnees.aujourdhui);
  const lu = useRef(donnees);
  lu.current = donnees;

  useEffect(() => {
    if (!jarvis || dejaLa || new Date().getHours() < HEURE_CLIN) return;
    if (lireDemande() === donnees.aujourdhui) return;
    const id = setTimeout(async () => {
      const d = lu.current;
      if (clinDuJour(d.couple, d.aujourdhui) || lireDemande() === d.aujourdhui) return;
      noterDemande(d.aujourdhui);
      try {
        const reponse = await jarvis.serveur.demanderJarvis({
          foyerId: jarvis.foyerId,
          demande: DEMANDE_CLIN,
          etat: decrireFoyer({ ...d, version: __VERSION__ }, d.membreId, d.aujourdhui),
          historique: [],
        });
        const clin = nouveauClin(d.aujourdhui, reponse.texte);
        if (clin) await depot.enregistrerCouple(clin);
      } catch {
        // Sans Jarvis aujourd'hui (plafond, hors ligne), le bandeau s'en passe.
      }
    }, ATTENTE_CLIN_MS);
    return () => clearTimeout(id);
  }, [jarvis, dejaLa, donnees.aujourdhui, depot]);
}

function lireDemande(): string | null {
  try {
    return localStorage.getItem(CLE_CLIN);
  } catch {
    return null;
  }
}
function noterDemande(jour: string) {
  try {
    localStorage.setItem(CLE_CLIN, jour);
  } catch {
    // Stockage indisponible : au pire, une demande de plus.
  }
}
