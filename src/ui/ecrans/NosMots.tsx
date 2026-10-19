import { useState, type FormEvent } from "react";
import {
  basculerCoeur,
  comptesAVenir,
  decrireCompte,
  estVisible,
  HUMEURS,
  humeurDu,
  LONGUEUR_BANDEAU,
  LONGUEUR_MOT,
  nomHumeur,
  nosMots,
  noterHumeur,
  nouveauCompte,
  nouveauMot,
  type Mot,
} from "../../domaine/bandeau";
import { ErreurValidation } from "../../domaine/foyer";
import type { Depot } from "../../donnees/depot";
import { useAnnoncer } from "../annulation";
import { contexteReel } from "../contexte";
import { Glissable } from "../Glissable";
import { vibrer } from "../haptique";
import { Icone, type NomIcone } from "../Icone";
import { Page } from "../pieces";

/** Les humeurs en pictogrammes au trait, dans le style de l'app (pas d'emoji). */
const PICTO_HUMEUR: Record<string, NomIcone> = {
  "😊": "sourire",
  "🥰": "coeur",
  "😌": "vague",
  "🎉": "soleil",
  "😴": "lune",
  "😤": "eclair",
  "🤯": "pluie",
  "🤒": "thermometre",
};
import type { DonneesModule } from "../modules";

type Quand = "maintenant" | "soir" | "matin";

/** L'heure d'un mot programmé : ce soir à 20 h, ou demain matin à 7 h. */
function heureDe(quand: Quand, maintenant = new Date()): string | undefined {
  if (quand === "maintenant") return undefined;
  const d = new Date(maintenant);
  if (quand === "soir") d.setHours(20, 0, 0, 0);
  else {
    d.setDate(d.getDate() + 1);
    d.setHours(7, 0, 0, 0);
  }
  return d.toISOString();
}

const formatHeure = (iso: string) =>
  new Date(iso).toLocaleString("fr-CH", { weekday: "long", hour: "numeric", minute: "2-digit" }).replace(":00", " h");

// « Nos mots » : écrire un mot à l'autre (tout de suite, ce soir ou demain matin), dire son
// humeur du jour, compter les jours jusqu'aux bons moments, et relire tous les mots échangés.
export function NosMots(props: {
  donnees: DonneesModule;
  depot: Depot;
  /** Prévient l'autre téléphone tout de suite ; null sans partage. */
  notifier: ((m: Mot) => Promise<void>) | null;
}) {
  const { donnees, depot } = props;
  const { foyer, membreId: moi, couple, aujourdhui } = donnees;
  const annoncer = useAnnoncer();
  const [texte, setTexte] = useState("");
  const [quand, setQuand] = useState<Quand>("maintenant");
  const [compte, setCompte] = useState({ titre: "", jour: "" });
  const [erreur, setErreur] = useState<string | null>(null);
  const maintenant = new Date().toISOString();
  const autre = foyer.membres.find((m) => m.id !== moi);
  const prenom = (id: string | null) => (id === moi ? "Toi" : foyer.membres.find((m) => m.id === id)?.prenom ?? "Quelqu'un");
  const mots = nosMots(couple, moi, maintenant);
  const comptes = comptesAVenir(couple, aujourdhui);
  const monHumeur = moi ? humeurDu(couple, moi, aujourdhui) : undefined;
  const sonHumeur = autre ? humeurDu(couple, autre.id, aujourdhui) : undefined;
  const soirPasse = new Date().getHours() >= 20;

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    try {
      const mot = nouveauMot(texte, moi, contexteReel, heureDe(quand));
      await depot.enregistrerCouple(mot);
      vibrer();
      setTexte("");
      setQuand("maintenant");
      setErreur(null);
      if (mot.programme) annoncer(`Ton mot arrivera ${formatHeure(mot.visibleDes)}.`, () => depot.supprimerCouple(mot.id));
      else props.notifier?.(mot).catch(() => {});
    } catch (err) {
      setErreur(err instanceof ErreurValidation ? err.message : "Le mot n'est pas parti, réessaie.");
    }
  }

  async function humeur(emoji: string) {
    if (!moi) return;
    vibrer();
    if (monHumeur?.emoji === emoji) await depot.supprimerCouple(monHumeur.id);
    else await depot.enregistrerCouple(noterHumeur(moi, aujourdhui, emoji));
  }

  async function ajouterCompte(e: FormEvent) {
    e.preventDefault();
    try {
      await depot.enregistrerCouple(nouveauCompte(compte.titre, compte.jour, moi, aujourdhui, contexteReel));
      vibrer();
      setCompte({ titre: "", jour: "" });
      setErreur(null);
    } catch (err) {
      setErreur(err instanceof ErreurValidation ? err.message : "Le compte à rebours n'a pas été ajouté.");
    }
  }

  async function retirer(doc: Mot | (typeof comptes)[number], message: string) {
    await depot.supprimerCouple(doc.id);
    annoncer(message, () => depot.enregistrerCouple(doc));
  }

  return (
    <Page
      titre="Nos mots"
      sousTitre={`Ce que tu écris ici défile dans le bandeau de l'accueil${autre ? ` de ${autre.prenom}` : ""}.`}
      aide={{ cle: "mots", texte: `Le bandeau en montre ${LONGUEUR_BANDEAU} caractères : le compteur te le dit. Touche un mot dans le bandeau pour renvoyer un cœur.` }}
      className="nos-mots"
    >

      <form className="carte mot-nouveau" onSubmit={(e) => void envoyer(e)}>
        <textarea
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          maxLength={LONGUEUR_MOT}
          rows={3}
          placeholder={autre ? `Un petit mot pour ${autre.prenom}…` : "Un petit mot…"}
          aria-label="Le mot"
        />
        <div className="mot-bas">
          <div className="puces" role="radiogroup" aria-label="Quand">
            <button type="button" className={`puce petite${quand === "maintenant" ? " active" : ""}`} onClick={() => setQuand("maintenant")}>Maintenant</button>
            {!soirPasse && (
              <button type="button" className={`puce petite${quand === "soir" ? " active" : ""}`} onClick={() => setQuand("soir")}>Ce soir 20 h</button>
            )}
            <button type="button" className={`puce petite${quand === "matin" ? " active" : ""}`} onClick={() => setQuand("matin")}>Demain 7 h</button>
          </div>
          <span className={`discret compteur${texte.length > LONGUEUR_BANDEAU ? " depasse" : ""}`} aria-live="polite">
            {texte.length > LONGUEUR_BANDEAU ? "Abrégé dans le bandeau" : `${LONGUEUR_BANDEAU - texte.length}`}
          </span>
        </div>
        <button type="submit" className="bouton-principal" disabled={!texte.trim()}>
          {quand === "maintenant" ? "Envoyer" : "Programmer"}
        </button>
      </form>
      {erreur && <p className="erreur" role="alert">{erreur}</p>}

      <h2 className="rayon">Humeur du jour</h2>
      <div className="carte humeurs">
        <div className="humeurs-choix" role="radiogroup" aria-label="Mon humeur">
          {HUMEURS.map((h) => (
            <button key={h.emoji} className={`humeur-bouton${monHumeur?.emoji === h.emoji ? " active" : ""}`} onClick={() => void humeur(h.emoji)} aria-label={h.nom} aria-pressed={monHumeur?.emoji === h.emoji}>
              <Icone nom={PICTO_HUMEUR[h.emoji] ?? "sourire"} taille={24} />
              <span className="humeur-nom">{h.nom}</span>
            </button>
          ))}
        </div>
        {autre && (
          <p className="discret">
            {sonHumeur ? `${autre.prenom} aujourd'hui : ${nomHumeur(sonHumeur.emoji).toLowerCase()}` : `${autre.prenom} n'a pas encore dit son humeur.`}
          </p>
        )}
      </div>

      <h2 className="rayon">Comptes à rebours</h2>
      {comptes.length > 0 && (
        <ul className="carte groupe">
          {comptes.map((c) => (
            <li key={c.id}>
              <Glissable onSupprimer={() => void retirer(c, "Compte à rebours retiré.")} libelle="Retirer">
                <div className="ligne">
                  <span className="ligne-texte">
                    {decrireCompte(c, aujourdhui)}
                    <span className="bulle-note">{new Date(`${c.jour}T12:00`).toLocaleDateString("fr-CH", { weekday: "long", day: "numeric", month: "long" })}</span>
                  </span>
                </div>
              </Glissable>
            </li>
          ))}
        </ul>
      )}
      <form className="ajout compte-nouveau" onSubmit={(e) => void ajouterCompte(e)}>
        <input value={compte.titre} onChange={(e) => setCompte({ ...compte, titre: e.target.value })} placeholder="Ex. Vacances au Portugal" aria-label="Le moment attendu" enterKeyHint="next" />
        <input type="date" value={compte.jour} min={aujourdhui} onChange={(e) => setCompte({ ...compte, jour: e.target.value })} aria-label="La date" />
        <button type="submit" disabled={!compte.titre.trim() || !compte.jour} aria-label="Ajouter le compte à rebours">+</button>
      </form>

      <h2 className="rayon">Tous nos mots</h2>
      {mots.length === 0 ? (
        <p className="vide">Pas encore de mot. Le premier est pour toi.</p>
      ) : (
        <ul className="carte groupe mots">
          {mots.map((m) => {
            const aime = !!moi && m.coeurs.includes(moi);
            const contenu = (
              <div className={`ligne mot${m.de === moi ? " de-moi" : ""}`}>
                <span className="ligne-texte">
                  {m.texte}
                  <span className="bulle-note">
                    {prenom(m.de)}, {estVisible(m, maintenant) ? new Date(m.visibleDes).toLocaleDateString("fr-CH", { day: "numeric", month: "long" }) : `prévu ${formatHeure(m.visibleDes)}`}
                  </span>
                </span>
                <button
                  className={`coeur-mot${aime ? " aime" : ""}${m.coeurs.length ? " rempli" : ""}`}
                  onClick={() => moi && void depot.enregistrerCouple(basculerCoeur(m, moi)).then(vibrer)}
                  aria-label={aime ? "Reprendre mon cœur" : "Envoyer un cœur"}
                  aria-pressed={aime}
                  disabled={!moi}
                >
                  <Icone nom="coeur" taille={18} />
                  {m.coeurs.length > 0 && <span>{m.coeurs.length}</span>}
                </button>
              </div>
            );
            return (
              <li key={m.id}>
                {m.de === moi ? <Glissable onSupprimer={() => void retirer(m, "Mot retiré.")} libelle="Retirer">{contenu}</Glissable> : contenu}
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
