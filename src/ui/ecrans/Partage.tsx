import { useCallback, useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { afficherCode, decrireDerniereSynchro, normaliserCode } from "../../domaine/synchro";
import type { Foyer } from "../../domaine/types";
import type { Compte, FoyerPartage, ServeurJarvis, ServeurRappels } from "../../donnees/distant";
import type { StatutSynchro, Synchro } from "../../donnees/synchro";

export interface ServicesPartage {
  compte: Compte;
  synchro: Synchro;
  /** Les rappels du matin passent par le même serveur. */
  rappels: ServeurRappels;
  /** Jarvis aussi : la clé de l'API reste sur le serveur. */
  jarvis: ServeurJarvis;
}

const LONGUEUR_MOT_DE_PASSE = 8;

const message = (e: unknown) => (e instanceof Error && e.message ? e.message : "Ça n'a pas marché, réessaie.");

/** Partager le foyer entre les deux iPhone : compte, partage ou code pour rejoindre, état de la synchro. */
export function Partage({ services, foyer }: { services: ServicesPartage | null; foyer: Foyer | null }) {
  if (!services) {
    return (
      <main>
        <h1>Partage</h1>
        <div className="carte partage-intro">
          <p>Le partage entre vos deux iPhone n'est pas encore activé sur cette version.</p>
          <p className="discret">Il le sera dès que le serveur du foyer sera prêt. Vos données restent sur ce téléphone en attendant.</p>
        </div>
      </main>
    );
  }
  return <PartageActif {...services} foyer={foyer} />;
}

function PartageActif({ compte, synchro, foyer }: ServicesPartage & { foyer: Foyer | null }) {
  const statut = useSyncExternalStore(synchro.abonner, synchro.statut);
  // undefined : on regarde encore ; null : pas de session ; email null : relié par le code seulement.
  const [session, setSession] = useState<{ email: string | null } | null | undefined>(undefined);
  const [avecCompte, setAvecCompte] = useState(false);
  const [foyers, setFoyers] = useState<FoyerPartage[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  const agir = async (action: () => Promise<void>) => {
    setErreur(null);
    setOccupe(true);
    try {
      await action();
    } catch (e) {
      setErreur(message(e));
    } finally {
      setOccupe(false);
    }
  };

  const chargerFoyers = useCallback(async () => {
    const liste = await compte.mesFoyers();
    setFoyers(liste);
    // Reconnexion sur un téléphone déjà relié : le partage reprend tout seul.
    if (foyer && synchro.statut().etat === "inactif" && liste.some((f) => f.id === foyer.id)) await synchro.reprendre(foyer.id);
  }, [compte, synchro, foyer]);

  useEffect(() => {
    compte.connecte().then(setSession, () => setSession(null));
  }, [compte]);

  useEffect(() => {
    if (session) chargerFoyers().catch((e) => setErreur(message(e)));
  }, [session, chargerFoyers]);

  // Pas besoin de compte : sans session, le téléphone en ouvre une juste pour le code du foyer.
  const assurerSession = async () => {
    if (session) return;
    await compte.entrerSansCompte();
    setSession({ email: null });
  };

  return (
    <main className="partage">
      <h1>Partage</h1>
      <p className="discret partage-intro-texte">
        Vos deux iPhone partagent les listes, les tâches et le suivi de Mitsu. Chacun garde tout sur son téléphone,
        même sans réseau ; les modifications se rejoignent dès que possible.
      </p>
      {session === undefined ? null : avecCompte && !session ? (
        <Connexion
          compte={compte}
          connecte={(email) => {
            setAvecCompte(false);
            setSession({ email });
          }}
          annuler={() => setAvecCompte(false)}
        />
      ) : statut.etat !== "inactif" && foyer ? (
        <FoyerRelie
          statut={statut}
          foyer={foyer}
          foyerPartage={foyers?.find((f) => f.id === foyer.id) ?? null}
          synchroniser={() => void synchro.synchroniser()}
        />
      ) : (
        <Relier
          foyer={foyer}
          foyers={session ? foyers : []}
          occupe={occupe}
          partager={() =>
            agir(async () => {
              if (!foyer) return;
              await assurerSession();
              await compte.creerFoyer(foyer.id, foyer.nom);
              await synchro.partager(foyer.id);
              setFoyers(await compte.mesFoyers());
            })
          }
          rejoindre={(cible) =>
            agir(async () => {
              await assurerSession();
              const id = "code" in cible ? await compte.rejoindreFoyer(cible.code) : cible.id;
              await synchro.rejoindre(id);
              setFoyers(await compte.mesFoyers());
            })
          }
        />
      )}
      {erreur && <p className="erreur partage-erreur" role="alert">{erreur}</p>}
      {session === null && !avecCompte && (
        <div className="partage-compte">
          <button className="lien" onClick={() => setAvecCompte(true)}>J'ai un compte (adresse e-mail)</button>
        </div>
      )}
      {session && (
        <div className="partage-compte">
          <p className="discret">{session.email ? `Connecté avec ${session.email}` : "Relié par le code du foyer"}</p>
          <button
            className="lien danger"
            disabled={occupe}
            onClick={() =>
              agir(async () => {
                await synchro.arreter();
                await compte.deconnecter();
                setFoyers(null);
                setSession(null);
              })
            }
          >
            {session.email ? "Se déconnecter" : "Quitter le partage"}
          </button>
          <p className="discret">
            {session.email ? "Les données restent sur ce téléphone." : "Les données restent sur ce téléphone ; le code permettra de revenir."}
          </p>
        </div>
      )}
    </main>
  );
}

function Connexion({ compte, connecte, annuler }: { compte: Compte; connecte: (email: string) => void; annuler: () => void }) {
  const [nouveau, setNouveau] = useState(false);
  const [adresse, setAdresse] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const valide = adresse.includes("@") && motDePasse.length >= LONGUEUR_MOT_DE_PASSE;

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setOccupe(true);
    try {
      if (nouveau) await compte.creerCompte(adresse.trim(), motDePasse);
      else await compte.connecter(adresse.trim(), motDePasse);
      connecte(adresse.trim());
    } catch (err) {
      setErreur(message(err));
    } finally {
      setOccupe(false);
    }
  }

  return (
    <form className="carte formulaire" onSubmit={soumettre}>
      <p className="partage-etape">{nouveau ? "Créer ton compte" : "Connexion"}</p>
      <label>
        Ton adresse e-mail
        <input
          type="email"
          value={adresse}
          onChange={(e) => setAdresse(e.target.value)}
          placeholder="prenom@exemple.ch"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          required
        />
      </label>
      <label>
        Mot de passe
        <input
          type="password"
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
          autoComplete={nouveau ? "new-password" : "current-password"}
          minLength={LONGUEUR_MOT_DE_PASSE}
          required
        />
      </label>
      {nouveau && (
        <p className="discret">Au moins {LONGUEUR_MOT_DE_PASSE} caractères. L'iPhone peut en proposer un et s'en souvenir pour toi.</p>
      )}
      <button type="submit" className="bouton-principal" disabled={occupe || !valide}>
        {occupe ? "Un instant…" : nouveau ? "Créer mon compte" : "Me connecter"}
      </button>
      <button type="button" className="lien" onClick={() => setNouveau(!nouveau)}>
        {nouveau ? "J'ai déjà un compte" : "Première fois ? Créer un compte"}
      </button>
      <button type="button" className="lien" onClick={annuler}>Revenir au code du foyer</button>
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
    </form>
  );
}

function Relier(props: {
  foyer: Foyer | null;
  foyers: FoyerPartage[] | null;
  occupe: boolean;
  partager: () => void;
  rejoindre: (cible: { code: string } | { id: string }) => void;
}) {
  const [saisie, setSaisie] = useState("");
  const [aConfirmer, setAConfirmer] = useState<{ code: string } | { id: string } | null>(null);
  if (!props.foyers) return <p className="discret">Recherche de votre foyer…</p>;
  const code = normaliserCode(saisie);
  const autres = props.foyers.filter((f) => f.id !== props.foyer?.id);

  // Rejoindre remplace ce que contient ce téléphone : on le dit avant.
  const demander = (cible: { code: string } | { id: string }) => (props.foyer ? setAConfirmer(cible) : props.rejoindre(cible));

  if (aConfirmer) {
    return (
      <div className="carte partage-confirmation">
        <p><strong>Remplacer les données de ce téléphone ?</strong></p>
        <p className="discret">
          Les listes, les tâches et le suivi de Mitsu de « {props.foyer?.nom} » seront remplacés par ceux du foyer partagé.
          Les notes de test restent.
        </p>
        <button className="bouton-principal" disabled={props.occupe} onClick={() => props.rejoindre(aConfirmer)}>
          {props.occupe ? "Connexion au foyer…" : "Remplacer et rejoindre"}
        </button>
        <button className="lien" disabled={props.occupe} onClick={() => setAConfirmer(null)}>Annuler</button>
      </div>
    );
  }

  if (autres.length > 0) {
    return (
      <>
        {autres.map((f) => (
          <div key={f.id} className="carte partage-choix">
            <p className="partage-etape">Ton foyer t'attend</p>
            <p><strong>Tu fais partie du foyer « {f.nom} »</strong></p>
            <button className="bouton-principal" disabled={props.occupe} onClick={() => demander({ id: f.id })}>
              Retrouver ce foyer
            </button>
          </div>
        ))}
      </>
    );
  }

  // Le code d'abord : c'est le cas du deuxième téléphone. Le premier partage juste en dessous.
  return (
    <>
      <form
        className="carte formulaire partage-choix"
        onSubmit={(e) => {
          e.preventDefault();
          if (code) demander({ code });
        }}
      >
        <p className="partage-etape">Rejoindre un foyer</p>
        <label>
          Code affiché sur l'autre iPhone
          <input
            className="partage-saisie-code"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            placeholder="K7Q-M4P"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        <p className="discret">Sur l'autre iPhone : Réglages, puis Partage. Pas besoin de compte.</p>
        <button type="submit" className="bouton-principal" disabled={props.occupe || !code}>
          {props.occupe ? "Connexion au foyer…" : "Rejoindre ce foyer"}
        </button>
      </form>
      {props.foyer && (
        <div className="carte partage-choix">
          <p className="partage-etape">Premier téléphone</p>
          <p><strong>Partager « {props.foyer.nom} »</strong></p>
          <p className="discret">Tout ce qui est sur ce téléphone devient commun, et un code s'affiche pour l'autre iPhone.</p>
          <button className="bouton-secondaire" disabled={props.occupe} onClick={props.partager}>
            {props.occupe ? "Partage en cours…" : "Partager ce foyer"}
          </button>
        </div>
      )}
    </>
  );
}

function FoyerRelie(props: {
  statut: StatutSynchro;
  foyer: Foyer;
  foyerPartage: FoyerPartage | null;
  synchroniser: () => void;
}) {
  const [maintenant, setMaintenant] = useState(() => new Date().toISOString());
  const [copie, setCopie] = useState(false);
  useEffect(() => {
    const minuterie = setInterval(() => setMaintenant(new Date().toISOString()), 30_000);
    return () => clearInterval(minuterie);
  }, []);
  const { statut } = props;
  const derniere = statut.etat === "inactif" ? null : statut.derniere;
  const code = props.foyerPartage?.code;

  return (
    <>
      <div className={`carte partage-etat ${statut.etat}`} role="status">
        <span className="partage-point" aria-hidden />
        <div className="ligne-texte">
          <p><strong>« {props.foyer.nom} » est partagé</strong></p>
          <p className="discret">
            {statut.etat === "en_cours"
              ? "Synchronisation…"
              : statut.etat === "erreur"
                ? `${statut.message} Dernière synchro : ${decrireDerniereSynchro(derniere, maintenant)}.`
                : derniere
                  ? `Synchronisé ${decrireDerniereSynchro(derniere, maintenant)}`
                  : "Première synchronisation à venir"}
          </p>
        </div>
        <button className="lien" disabled={statut.etat === "en_cours"} onClick={props.synchroniser}>
          Synchroniser
        </button>
      </div>
      {code && (
        <div className="carte partage-invitation">
          <p className="partage-etape">Code pour rejoindre ce foyer</p>
          <p className="partage-code">{afficherCode(code)}</p>
          <p className="discret">
            Sur l'autre iPhone : Réglages, puis Partage, et taper ce code. Pas besoin de compte.
          </p>
          {typeof navigator !== "undefined" && navigator.clipboard && (
            <button
              className="lien"
              onClick={() =>
                navigator.clipboard.writeText(afficherCode(code)).then(
                  () => setCopie(true),
                  () => setCopie(false),
                )
              }
            >
              {copie ? "Code copié" : "Copier le code"}
            </button>
          )}
        </div>
      )}
    </>
  );
}
