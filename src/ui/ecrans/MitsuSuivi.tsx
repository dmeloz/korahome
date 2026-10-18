import { useState, type FormEvent } from "react";
import { Feuille } from "../Feuille";
import {
  ecarterProposition,
  ficheDeGarde,
  historiquePesees,
  journalRecent,
  derniereLitiere,
  modifierInfos,
  noterEvenement,
  poidsRepere,
  propositionsCarnet,
  reprendreProposition,
  resumeVeto,
  retirerEvenement,
  SOUCIS,
  TYPES_EVENEMENT,
  type Animal,
  type InfosAnimal,
  type TypeEvenement,
} from "../../domaine/mitsu";
import { decaler, ecartJours } from "../../domaine/taches";
import type { Membre } from "../../domaine/types";
import { contexteReel } from "../contexte";
import { Glissable } from "../Glissable";
import { vibrer } from "../haptique";
import { copierRapport } from "../rapport";

// Les ajouts de la 0.0.14 au suivi de Mitsu : journal du quotidien, courbe de poids,
// carnet prérempli, fiches à partager (vétérinaire, garde) et informations pratiques.

/** « 9 juin », avec l'année quand ce n'est pas celle-ci : « 4 août 2027 ». */
const dateCourte = (jour: string, aujourdhui?: string) =>
  new Date(`${jour}T12:00:00`).toLocaleDateString("fr-CH", {
    day: "numeric",
    month: "long",
    year: aujourdhui && jour.slice(0, 4) !== aujourdhui.slice(0, 4) ? "numeric" : undefined,
  });

interface Commun {
  animal: Animal;
  aujourdhui: string;
  /** Enregistre, et propose « Annuler » quand un texte est donné. */
  modifier: (fabrique: () => Animal, annonce?: string) => void;
}

// ----- Journal -----

const ORDRE_JOURNAL: TypeEvenement[] = ["litiere", ...SOUCIS, "autre"];

function ilYa(jour: string, aujourdhui: string): string {
  const n = ecartJours(jour, aujourdhui);
  return n <= 0 ? "aujourd'hui" : n === 1 ? "hier" : `il y a ${n} jours`;
}

export function Journal(props: Commun & { membres: Membre[]; membreId: string | null }) {
  const { animal, aujourdhui, modifier } = props;
  const [autre, setAutre] = useState<string | null>(null);
  const [hier, setHier] = useState(false);
  const jour = hier ? decaler(aujourdhui, { unite: "jour", tous: -1 }) : aujourdhui;
  const prenom = (id: string | null) => props.membres.find((m) => m.id === id)?.prenom;
  const litiere = derniereLitiere(animal);
  const recents = journalRecent(animal).slice(0, 6);

  function noter(quoi: TypeEvenement, note = "") {
    vibrer();
    modifier(() => noterEvenement(animal, quoi, jour, note, props.membreId, contexteReel), `${TYPES_EVENEMENT[quoi]}${hier ? " hier" : ""} : noté.`);
    setHier(false);
  }

  function noterAutre(e: FormEvent) {
    e.preventDefault();
    if (!autre?.trim()) return;
    noter("autre", autre);
    setAutre(null);
  }

  return (
    <div className="carte mitsu-journal">
      <div className="puces" role="group" aria-label="Noter dans le journal">
        {ORDRE_JOURNAL.map((q) => (
          <button
            type="button"
            key={q}
            className={`puce${q === "autre" && autre !== null ? " active" : ""}${SOUCIS.includes(q) ? " mitsu-souci" : ""}`}
            onClick={() => (q === "autre" ? setAutre(autre === null ? "" : null) : noter(q))}
          >
            {TYPES_EVENEMENT[q]}
          </button>
        ))}
        <button type="button" className={`puce petite${hier ? " active" : ""}`} aria-pressed={hier} onClick={() => setHier(!hier)}>
          C'était hier
        </button>
      </div>
      {autre !== null && (
        <form onSubmit={noterAutre} className="ajout">
          <input value={autre} onChange={(e) => setAutre(e.target.value)} placeholder="Ce qui s'est passé" aria-label="Ce qui s'est passé" autoFocus />
          <button type="submit" disabled={!autre.trim()} aria-label="Noter">+</button>
        </form>
      )}
      <p className="discret">
        {litiere
          ? `Litière changée ${ilYa(litiere.jour, aujourdhui)}${prenom(litiere.par) ? `, par ${prenom(litiere.par)}` : ""}.`
          : "Un geste suffit : l'app prévient si un souci revient (vomir, ne pas manger…)."}
      </p>
      {recents.length > 0 && (
        <ul className="groupe mitsu-journal-liste">
          {recents.map((e) => (
            <li key={e.id}>
              <Glissable className="ligne" libelle="Retirer" onSupprimer={() => modifier(() => retirerEvenement(animal, e.id), `« ${TYPES_EVENEMENT[e.quoi]} » retiré du journal.`)}>
                <span className={`ligne-texte${SOUCIS.includes(e.quoi) ? " urgent-texte" : ""}`}>
                  {e.quoi === "autre" ? e.note : TYPES_EVENEMENT[e.quoi]}
                  {e.quoi !== "autre" && e.note ? ` · ${e.note}` : ""}
                </span>
                <span className="discret mitsu-quand">
                  {ilYa(e.jour, aujourdhui)}
                  {prenom(e.par) ? ` · ${prenom(e.par)}` : ""}
                </span>
              </Glissable>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ----- Courbe de poids -----

/** Ses pesées sur la zone habituelle d'un chat de son âge, de la naissance à au moins 1 an. */
export function CourbePoids({ animal, aujourdhui }: { animal: Animal; aujourdhui: string }) {
  const pesees = historiquePesees(animal).reverse();
  const unAn = decaler(animal.naissance, { unite: "mois", tous: 13 });
  const fin = [aujourdhui, unAn, ...pesees.map((p) => p.jour)].reduce((a, b) => (a > b ? a : b));
  const duree = Math.max(1, ecartJours(animal.naissance, fin));
  const mois = Math.ceil(duree / 30.44);
  const echantillons = Array.from({ length: mois + 1 }, (_, i) => {
    const jour = decaler(animal.naissance, { unite: "mois", tous: i });
    return { jour, ...poidsRepere(animal.naissance, jour, animal.sexe) };
  });
  const haut = Math.max(...echantillons.map((e) => e.max), ...pesees.map((p) => p.grammes)) * 1.05;
  const L = 320;
  const H = 150;
  const x = (jour: string) => (ecartJours(animal.naissance, jour) / duree) * L;
  const y = (g: number) => H - (g / haut) * H;
  const bande = [...echantillons.map((e) => `${x(e.jour)},${y(e.max)}`), ...[...echantillons].reverse().map((e) => `${x(e.jour)},${y(e.min)}`)].join(" ");
  const mediane = echantillons.map((e) => `${x(e.jour)},${y(e.median)}`).join(" ");
  const trace = pesees.map((p) => `${x(p.jour)},${y(p.grammes)}`).join(" ");
  const kg = Array.from({ length: Math.floor(haut / 1000) }, (_, i) => (i + 1) * 1000);

  return (
    <figure className="mitsu-courbe">
      <svg viewBox={`-28 -6 ${L + 36} ${H + 24}`} role="img" aria-label={`Courbe de poids de ${animal.nom} comparée au poids habituel d'un chat de son âge`}>
        {kg.map((g) => (
          <g key={g}>
            <line x1={0} x2={L} y1={y(g)} y2={y(g)} className="mitsu-courbe-grille" />
            <text x={-6} y={y(g) + 4} textAnchor="end" className="mitsu-courbe-texte">{g / 1000} kg</text>
          </g>
        ))}
        <polygon points={bande} className="mitsu-courbe-bande" />
        <polyline points={mediane} className="mitsu-courbe-mediane" />
        <line x1={x(aujourdhui)} x2={x(aujourdhui)} y1={0} y2={H} className="mitsu-courbe-aujourdhui" />
        {[6, 12].filter((m) => m <= mois).map((m) => {
          const jour = decaler(animal.naissance, { unite: "mois", tous: m });
          return <text key={m} x={x(jour)} y={H + 16} textAnchor="middle" className="mitsu-courbe-texte">{m === 12 ? "1 an" : `${m} mois`}</text>;
        })}
        {pesees.length > 1 && <polyline points={trace} className="mitsu-courbe-trace" />}
        {pesees.map((p) => (
          <circle key={p.id} cx={x(p.jour)} cy={y(p.grammes)} r={4} className="mitsu-courbe-point" />
        ))}
      </svg>
      <figcaption className="discret">La zone claire est le poids habituel d'un chat de son âge : un repère, les chats varient beaucoup.</figcaption>
    </figure>
  );
}

// ----- Carnet prérempli -----

export function CarnetPropose({ animal, aujourdhui, modifier }: Commun) {
  const propositions = propositionsCarnet(animal, aujourdhui);
  if (propositions.length === 0) return null;
  return (
    <div className="carte mitsu-carnet">
      <p className="discret">
        Le calendrier habituel d'un chaton. Coche ce que dit son carnet, ou photographie la page dans Jarvis : il recopie les dates.
      </p>
      <ul className="groupe">
        {propositions.map((p) => {
          const passe = p.date < aujourdhui;
          return (
            <li key={p.cle} className="mitsu-provision">
              <div className="ligne-texte">
                <strong>{p.libelle}</strong>
                <span className="tache-details">{p.date === aujourdhui ? "à faire ou à cocher" : `${passe ? "normalement vers le" : "vers le"} ${dateCourte(p.date, aujourdhui)}`}</span>
              </div>
              <div className="tache-actions mitsu-actions">
                <button className="lien" onClick={() => modifier(() => reprendreProposition(animal, p, true, aujourdhui, contexteReel), `« ${p.libelle} » noté comme fait.`)}>
                  {p.cle === "sterilisation" ? "Déjà fait" : "Fait"}
                </button>
                <button className="lien" onClick={() => modifier(() => reprendreProposition(animal, p, false, aujourdhui, contexteReel), `« ${p.libelle} » prévu.`)}>
                  Prévoir
                </button>
                <button className="lien discret" onClick={() => modifier(() => ecarterProposition(animal, p.cle), `« ${p.libelle} » écarté.`)}>
                  Pas pour elle
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ----- Fiches à partager -----

async function partagerTexte(titre: string, texte: string): Promise<"partage" | "copie" | "echec"> {
  try {
    if (navigator.share) {
      await navigator.share({ title: titre, text: texte });
      return "partage";
    }
  } catch {
    return "echec"; // partage annulé
  }
  return (await copierRapport(texte)) ? "copie" : "echec";
}

export function Fiches({ animal, aujourdhui, informer }: { animal: Animal; aujourdhui: string; informer: (texte: string) => void }) {
  const [ouverte, setOuverte] = useState<"veto" | "garde" | null>(null);
  const titre = ouverte === "veto" ? `${animal.nom} : pour le vétérinaire` : `Garder ${animal.nom}`;
  const texte = ouverte === "veto" ? resumeVeto(animal, aujourdhui) : ouverte === "garde" ? ficheDeGarde(animal, aujourdhui) : "";

  async function partager() {
    const r = await partagerTexte(titre, texte);
    if (r === "copie") informer("Fiche copiée : colle-la dans un message.");
  }

  return (
    <div className="carte mitsu-fiches">
      <div className="puces" role="group" aria-label="Fiche à préparer">
        <button type="button" className={`puce${ouverte === "veto" ? " active" : ""}`} aria-pressed={ouverte === "veto"} onClick={() => setOuverte("veto")}>
          Pour le vétérinaire
        </button>
        <button type="button" className={`puce${ouverte === "garde" ? " active" : ""}`} aria-pressed={ouverte === "garde"} onClick={() => setOuverte("garde")}>
          Pour la garde
        </button>
      </div>
      <p className="discret">Un résumé prêt à montrer à la visite, ou à envoyer à qui la garde pendant les vacances.</p>
      <Feuille ouverte={ouverte !== null} onFermer={() => setOuverte(null)} titre={titre}>
        <pre className="mitsu-fiche-texte">{texte}</pre>
        <button className="bouton-principal" onClick={partager}>Partager</button>
      </Feuille>
    </div>
  );
}

// ----- Informations pratiques -----

const CHAMPS_INFOS: { cle: keyof InfosAnimal; libelle: string; exemple: string; clavier?: "tel" }[] = [
  { cle: "puce", libelle: "Numéro de puce", exemple: "756 …" },
  { cle: "veterinaire", libelle: "Vétérinaire", exemple: "Nom du cabinet" },
  { cle: "telephoneVeto", libelle: "Téléphone du vétérinaire", exemple: "021 …", clavier: "tel" },
  { cle: "assurance", libelle: "Assurance", exemple: "Compagnie et numéro de police" },
  { cle: "consignes", libelle: "Pour la garde", exemple: "Ses cachettes, ses habitudes" },
];

export function Infos({ animal, modifier }: Pick<Commun, "animal" | "modifier">) {
  const [valeurs, setValeurs] = useState<InfosAnimal>(animal.infos ?? {});
  const change = CHAMPS_INFOS.some(({ cle }) => (valeurs[cle] ?? "").trim() !== (animal.infos?.[cle] ?? ""));

  function enregistrer(e: FormEvent) {
    e.preventDefault();
    modifier(() => modifierInfos(animal, valeurs));
  }

  return (
    <form onSubmit={enregistrer} className="formulaire mitsu-fiche">
      {CHAMPS_INFOS.map(({ cle, libelle, exemple, clavier }) => (
        <label key={cle}>
          {libelle}
          <input
            value={valeurs[cle] ?? ""}
            onChange={(e) => setValeurs({ ...valeurs, [cle]: e.target.value })}
            placeholder={exemple}
            inputMode={clavier}
            autoComplete="off"
          />
        </label>
      ))}
      <button type="submit" className="bouton-principal" disabled={!change}>Enregistrer</button>
    </form>
  );
}
