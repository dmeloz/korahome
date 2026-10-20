import { useState } from "react";
import { expliquerErreur } from "../../domaine/erreurs";
import type { CompteIcloud } from "../../domaine/agenda";
import type { Foyer, Id } from "../../domaine/types";
import type { ServeurAgenda } from "../../donnees/distant";
import { Feuille } from "../Feuille";
import { vibrer } from "../haptique";
import { Page } from "../pieces";

// Le calendrier de l'iPhone, rangé dans les Réglages : relier son iCloud, choisir les
// calendriers à voir dans Kora, synchroniser ou délier. L'agenda garde toute la place.

type Distant = { serveur: ServeurAgenda; foyerId: string } | null;

/** Mon compte iCloud a un souci : la ligne des Réglages le signale. */
export const icloudEnErreur = (comptes: readonly CompteIcloud[], membreId: Id | null) => !!comptes.find((c) => c.membre === membreId)?.erreur;

const quand = (iso: string | null) => {
  if (!iso) return "pas encore synchronisé";
  const d = new Date(iso);
  return `synchronisé ${d.toDateString() === new Date().toDateString() ? "à" : `le ${d.toLocaleDateString("fr-CH", { day: "numeric", month: "short" })} à`} ${d.toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" })}`;
};

/** Relier son iCloud : l'agenda arrive dans l'app Calendrier, et l'iPhone revient dans Kora. */
export function CalendrierIphone(props: { foyer: Foyer; membreId: Id | null; comptes: CompteIcloud[]; distant: Distant; ouvrirPartage: () => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [reglage, setReglage] = useState(false);
  const [appleId, setAppleId] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const mien = props.comptes.find((c) => c.membre === props.membreId) ?? null;

  async function faire(quoi: string, action: () => Promise<void>, suite?: () => void) {
    setEnCours(quoi);
    setErreur(null);
    try {
      await action();
      vibrer();
      suite?.();
    } catch (e) {
      setErreur(expliquerErreur(e, "Le lien avec iCloud"));
    } finally {
      setEnCours(null);
    }
  }

  const d = props.distant;
  return (
    <Page titre="Calendrier de l'iPhone" className="reglages avec-cadre">
      <div className="carte agenda-icloud">
        {!d ? (
          <>
            <p className="discret">Une fois le foyer partagé, l'agenda pourra se relier à l'iCloud de chacun.</p>
            <button className="bouton-principal" onClick={props.ouvrirPartage}>Activer le partage</button>
          </>
        ) : (
          <>
            <p className="discret">
              Relié, ton iCloud reçoit un calendrier « Kora » avec tout l'agenda du foyer. Ce que tu y ajoutes ou modifies sur l'iPhone revient ici, et tes autres calendriers choisis s'affichent dans Kora.
            </p>
            <ul className="agenda-comptes">
              {props.foyer.membres.map((m) => {
                const c = props.comptes.find((x) => x.membre === m.id);
                return (
                  <li key={m.id} className="ligne">
                    <span className="agenda-pastille" style={{ background: m.couleur }} aria-hidden />
                    <span className="agenda-texte">
                      <span className="ligne-texte">{m.prenom}</span>
                      <span className={`tache-details${c?.erreur ? " retard" : ""}`}>{c ? (c.erreur ?? `${c.appleId}, ${quand(c.derniereSynchro)}`) : "Pas relié"}</span>
                    </span>
                    {m.id === props.membreId && (
                      <button className="lien" onClick={() => (c && !c.erreur ? setReglage(true) : (setOuvert(true), setErreur(null)))}>
                        {c ? (c.erreur ? "Relier à nouveau" : "Régler") : "Relier"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            {props.comptes.length > 0 && (
              <button className="lien" disabled={!!enCours} onClick={() => void faire("synchro", () => d.serveur.synchroniserAgenda(d.foyerId))}>
                {enCours === "synchro" ? "Synchronisation…" : "Synchroniser maintenant"}
              </button>
            )}
            {erreur && !ouvert && !reglage && <p className="erreur">{erreur}</p>}
          </>
        )}
      </div>

      <Feuille ouverte={ouvert} onFermer={() => setOuvert(false)} titre="Relier mon iCloud" fermer="Annuler">
        {d && props.membreId && (
          <form
            className="formulaire agenda-formulaire"
            onSubmit={(e) => {
              e.preventDefault();
              void faire("relier", () => d.serveur.relierIcloud({ foyerId: d.foyerId, membreId: props.membreId!, appleId, motDePasse }), () => {
                setMotDePasse("");
                setOuvert(false);
              });
            }}
          >
            <ol className="agenda-etapes">
              <li>
                Ouvre <a href="https://account.apple.com" target="_blank" rel="noreferrer">account.apple.com</a> et connecte-toi.
              </li>
              <li>Dans « Connexion et sécurité », touche « Mots de passe pour app », puis « + ».</li>
              <li>Nomme-le « Kora », puis copie le mot de passe affiché (quatre groupes de quatre lettres).</li>
            </ol>
            <label>
              Identifiant Apple
              <input type="email" value={appleId} onChange={(e) => setAppleId(e.target.value)} placeholder="prenom@icloud.com" autoComplete="username" inputMode="email" />
            </label>
            <label>
              Mot de passe d'app
              <input type="password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} placeholder="abcd-efgh-ijkl-mnop" autoComplete="off" />
            </label>
            <p className="discret">Ce n'est pas ton mot de passe Apple : celui-ci ne sert qu'aux calendriers, et tu peux le retirer à tout moment chez Apple. Il reste sur le serveur du foyer, ce téléphone ne le garde pas.</p>
            {erreur && <p className="erreur">{erreur}</p>}
            <button type="submit" className="bouton-principal" disabled={!appleId.trim() || !motDePasse.trim() || !!enCours}>
              {enCours === "relier" ? "Connexion à iCloud…" : "Relier"}
            </button>
          </form>
        )}
      </Feuille>

      <Feuille ouverte={reglage} onFermer={() => setReglage(false)} titre="Mon iCloud">
        {d && mien && props.membreId && (
          <div className="formulaire agenda-formulaire">
            <p className="discret">Les calendriers à voir dans Kora. Le calendrier « Kora » est toujours relié.</p>
            <ul className="carte groupe">
              {mien.calendriers.map((cal) => (
                <li key={cal.url}>
                  <button
                    type="button"
                    className="ligne chef-interrupteur"
                    disabled={!!enCours}
                    aria-pressed={cal.lu}
                    onClick={() =>
                      void faire("choisir", () =>
                        d.serveur.choisirCalendriers({
                          foyerId: d.foyerId,
                          membreId: props.membreId!,
                          ignores: mien.calendriers.filter((x) => (x.url === cal.url ? x.lu : !x.lu)).map((x) => x.url),
                        }),
                      )
                    }
                  >
                    <span className="ligne-texte">{cal.nom}</span>
                    <span className={`interrupteur${cal.lu ? " actif" : ""}`} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            {enCours === "choisir" && <p className="discret">Mise à jour…</p>}
            {erreur && <p className="erreur">{erreur}</p>}
            <button type="button" className="lien" onClick={() => { setReglage(false); setOuvert(true); }}>
              Changer le mot de passe d'app
            </button>
            <button
              type="button"
              className="lien danger"
              disabled={!!enCours}
              onClick={() => void faire("delier", () => d.serveur.delierIcloud({ foyerId: d.foyerId, membreId: props.membreId! }), () => setReglage(false))}
            >
              Délier mon iCloud
            </button>
            <p className="discret">Délié, le calendrier « Kora » reste sur l'iPhone : supprime-le dans l'app Calendrier si tu n'en veux plus.</p>
          </div>
        )}
      </Feuille>
    </Page>
  );
}
