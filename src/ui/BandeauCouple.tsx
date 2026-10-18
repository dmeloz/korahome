import { useEffect, useRef } from "react";
import { basculerCoeur, clinDuJour, DEMANDE_CLIN, elementsBandeau, infosUtiles, nouveauClin, type ElementBandeau } from "../domaine/bandeau";
import { decrireFoyer } from "../domaine/jarvis";
import type { Depot } from "../donnees/depot";
import type { ServeurJarvis } from "../donnees/distant";
import { vibrer } from "./haptique";
import { Icone } from "./Icone";
import type { DonneesModule } from "./modules";

// Le bandeau du couple, sous « Bonjour, Melo » : il défile doucement de droite à gauche,
// comme un fil d'infos. Toucher un mot de l'autre lui renvoie un cœur ; toucher ailleurs
// ouvre « Nos mots ».

const CLE_CLIN = "korahome.clinDemande";
/** Le temps de laisser la synchro apporter le clin d'œil déjà demandé par l'autre téléphone. */
const ATTENTE_CLIN_MS = 8000;
/** Le clin d'œil se demande à partir de 6 h. */
const HEURE_CLIN = 6;

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
  const longueur = elements.reduce((n, el) => n + el.texte.length + 6, 0);
  const duree = Math.max(18, longueur * 0.2);
  const fil = (copie: number) =>
    elements.map((el) => {
      const aime = !!el.mot && !!donnees.membreId && el.mot.coeurs.includes(donnees.membreId);
      return (
        <span key={`${copie}-${el.cle}`} className={`bandeau-element genre-${el.genre}${aime ? " aime" : ""}`} onClick={el.mot ? (e) => void coeur(e, el) : undefined}>
          {el.genre === "mot" && <Icone nom="coeur" taille={13} />}
          {el.texte}
        </span>
      );
    });

  return (
    <div
      className="bandeau-couple"
      role="button"
      tabIndex={0}
      aria-label={`Nos mots : ${elements.map((el) => el.texte).join(". ")}`}
      onClick={props.ouvrir}
      onKeyDown={(e) => (e.key === "Enter" ? props.ouvrir() : undefined)}
    >
      <div className="bandeau-fil" style={{ animationDuration: `${duree}s` }} aria-hidden>
        <span className="bandeau-copie">{fil(1)}</span>
        <span className="bandeau-copie">{fil(2)}</span>
      </div>
    </div>
  );
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
