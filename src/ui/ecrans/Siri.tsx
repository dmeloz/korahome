import { useState } from "react";
import { demandeRaccourciSiri, nomPropose } from "../../domaine/siri";
import type { Foyer, Id } from "../../domaine/types";
import type { ServeurJarvis } from "../../donnees/distant";
import { vibrer } from "../haptique";
import { Page } from "../pieces";
import { CLES, ecrireJson, effacer, lireJson } from "../stockageLocal";

// Jarvis dans Siri, rangé dans les Réglages : créer le lien de cet iPhone et copier la demande
// à coller dans Raccourcis. Les règles sont dans src/domaine/siri.ts.

/** L'adresse et le nom du raccourci de cet iPhone : ils restent sur ce téléphone, pour les recopier. */
function lire(): { adresse: string; nom: string } | null {
  const v = lireJson<{ adresse?: unknown; nom?: unknown } | null>(CLES.siri, null);
  return v && typeof v.adresse === "string" && typeof v.nom === "string" ? (v as { adresse: string; nom: string }) : null;
}

function garder(v: { adresse: string; nom: string } | null) {
  // Navigation privée : le lien marche quand même, il faudra seulement le recréer pour le recopier.
  if (v) ecrireJson(CLES.siri, v);
  else effacer(CLES.siri);
}

/** La ligne des Réglages : relié ou pas, sur cet iPhone. */
export const siriRelie = () => !!lire();

const ETAPES = [
  "Dans Raccourcis, touche + puis colle la demande copiée dans « Décrire un raccourci ».",
  "Vérifie le résultat : « Demander une saisie », puis « Obtenir le contenu de » avec ton adresse (Méthode POST, Corps JSON, champ demande), puis « Énoncer le texte ».",
  "Dis « Dis Siri » suivi du nom du raccourci, puis ta demande : « ajoute du lait », « qu'est-ce qu'on a demain ? ». Pour supprimer, il te demande oui ou non ; « annule » défait ce qu'il vient de faire.",
];

export function Siri(props: { foyer: Foyer; membreId: Id | null; distant: { serveur: ServeurJarvis; foyerId: string } | null; ouvrirPartage: () => void }) {
  const moi = props.foyer.membres.find((m) => m.id === props.membreId);
  const [relie, setRelie] = useState(lire);
  const [nom, setNom] = useState(() => relie?.nom ?? nomPropose(moi?.prenom));
  const [etat, setEtat] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const d = props.distant;

  async function copier(texte: string, quoi: string) {
    try {
      await navigator.clipboard.writeText(texte);
      setEtat(quoi);
    } catch {
      setEtat("Copie impossible : touche longuement l'adresse pour la copier.");
    }
  }

  async function creer() {
    if (!d) return;
    if (!props.membreId) {
      setEtat("Choisis d'abord à qui est cet iPhone (Réglages).");
      return;
    }
    const choisi = nom.trim() || nomPropose(moi?.prenom);
    setOccupe(true);
    setEtat(null);
    try {
      const adresse = await d.serveur.lienSiri({ foyerId: d.foyerId, membreId: props.membreId, nom: choisi });
      const nouveau = { adresse, nom: choisi };
      garder(nouveau);
      setRelie(nouveau);
      vibrer();
      await copier(demandeRaccourciSiri(adresse, choisi), "Demande copiée : colle-la dans Raccourcis.");
    } catch (e) {
      setEtat(e instanceof Error ? e.message : "Le lien n'a pas pu être créé.");
    } finally {
      setOccupe(false);
    }
  }

  async function retirer() {
    if (!d || !props.membreId) return;
    setOccupe(true);
    try {
      await d.serveur.retirerLienSiri({ foyerId: d.foyerId, membreId: props.membreId });
      garder(null);
      setRelie(null);
      setEtat("Lien retiré : Siri ne parle plus à Kora depuis cet iPhone. Supprime aussi le raccourci.");
    } catch (e) {
      setEtat(e instanceof Error ? e.message : "Le lien n'a pas pu être retiré.");
    } finally {
      setOccupe(false);
    }
  }

  return (
    <Page titre="Siri" className="reglages avec-cadre">
      <div className="carte formulaire">
        <p className="discret">
          « Dis Siri, {relie?.nom ?? (nom.trim() || "Tael")} » : tu parles à l'assistant de Kora sans ouvrir l'app, même l'iPhone verrouillé. Il agit comme dans l'app et répond à voix haute ; ce qui supprime attend ton oui.
        </p>
        {!d ? (
          <>
            <p className="discret">Siri passe par le serveur du foyer : il faut d'abord activer le partage.</p>
            <button className="bouton-principal" onClick={props.ouvrirPartage}>Activer le partage</button>
          </>
        ) : relie ? (
          <>
            <p className="surtitre">Cet iPhone est relié · « {relie.nom} »</p>
            <p className="budget-adresse">{relie.adresse}</p>
            <div className="budget-actions">
              <button type="button" className="bouton-principal" onClick={() => void copier(demandeRaccourciSiri(relie.adresse, relie.nom), "Demande copiée : colle-la dans Raccourcis.")}>
                Copier la demande
              </button>
              <button type="button" className="bouton-secondaire" onClick={() => void copier(relie.adresse, "Adresse copiée.")}>
                Copier l'adresse
              </button>
              <button type="button" className="bouton-secondaire" disabled={occupe} onClick={() => void retirer()}>
                Retirer le lien
              </button>
            </div>
          </>
        ) : (
          <>
            <label>
              Le nom à dire après « Dis Siri »
              <input value={nom} maxLength={30} onChange={(e) => setNom(e.target.value)} autoCapitalize="words" />
            </label>
            <button type="button" className="bouton-principal" disabled={occupe} onClick={() => void creer()}>
              {occupe ? "Création…" : "Créer le lien de cet iPhone"}
            </button>
          </>
        )}
        {etat && <p className="discret">{etat}</p>}
        {d && (
          <>
            <p className="surtitre">Dans Raccourcis, une seule fois</p>
            <ol className="budget-etapes">
              {ETAPES.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ol>
            <p className="discret">Chaque iPhone a son propre lien : Siri sait ainsi qui parle. Ses réponses comptent dans le plafond de 5 CHF par mois de l'assistant.</p>
          </>
        )}
      </div>
    </Page>
  );
}
