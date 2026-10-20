import { feteFee } from "../fee";
import { useEffect, useState } from "react";
import { Feuille } from "../Feuille";
import { appliquerEtalement, appliquerRepartition, compteRepartition, etalementPropose, proposerRepartition, tachesDeLaSemaine } from "../../domaine/repartition";
import {
  TACHES_DE_LA_SEMAINE,
  decrireEcheance,
  decrireRecurrence,
  estTerminee,
  liberer,
  marquerFaite,
  tachesDeDepart,
  organiserTaches,
  prendre,
  type Filtre,
} from "../../domaine/taches";
import type { Foyer, Tache } from "../../domaine/types";
import type { Depot } from "../../donnees/depot";
import { aujourdhuiLocal, contexteReel } from "../contexte";
import { Glissable } from "../Glissable";
import { vibrer } from "../haptique";
import { equilibreDesTaches, equilibreVisible } from "../../domaine/apprentissage";
import { noterUsage } from "../usage";
import { Onglets, Page } from "../pieces";
import { Icone } from "../Icone";

// Les tâches de la maison. On en ajoute d'une phrase dans la barre Jarvis (« linge chaque
// mercredi ») ; on glisse une tâche vers la droite pour la marquer faite, vers la gauche
// pour la supprimer ; un appui long ouvre sa fiche. Le dimanche, on se répartit la semaine.

const CLE_REPARTITION = "korahome.derniereRepartition";

/** Le dernier dimanche où la semaine a été répartie sur ce téléphone. */
export function lireDerniereRepartition(): string | null {
  try {
    return localStorage.getItem(CLE_REPARTITION);
  } catch {
    return null;
  }
}

function noterRepartition(jour: string): void {
  try {
    localStorage.setItem(CLE_REPARTITION, jour);
  } catch {
    // Stockage indisponible : Kora reproposera, sans gravité.
  }
}

// « On se répartit la semaine ? » touché sur l'accueil : la page s'ouvre sur la répartition.
let repartitionDemandee = false;
export const demanderRepartition = () => {
  repartitionDemandee = true;
};

const FILTRES: { id: Filtre; libelle: string }[] = [
  { id: "toutes", libelle: "Toutes" },
  { id: "miennes", libelle: "Les miennes" },
  { id: "libres", libelle: "Libres" },
];

export function Taches(props: { depot: Depot; foyer: Foyer; membreId: string | null; taches: Tache[] }) {
  const aujourdhui = aujourdhuiLocal();
  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [aSupprimer, setASupprimer] = useState<string | null>(null);
  const [repartir, setRepartir] = useState(() => {
    const demandee = repartitionDemandee;
    repartitionDemandee = false;
    return demandee;
  });
  const [annulable, setAnnulable] = useState<{ texte: string; avant: Tache } | null>(null);

  useEffect(() => {
    if (!annulable) return;
    const minuterie = setTimeout(() => setAnnulable(null), 6000);
    return () => clearTimeout(minuterie);
  }, [annulable]);

  const moi = props.membreId;
  const membre = (id: string | null) => props.foyer.membres.find((m) => m.id === id);
  const plusieurs = props.foyer.membres.length > 1;
  const { groupes, terminees } = organiserTaches(props.taches, aujourdhui, filtre, moi);

  async function faire(t: Tache) {
    vibrer();
    const apres = marquerFaite(t, moi, aujourdhui, contexteReel);
    await props.depot.enregistrerTache(apres);
    feteFee();
    noterUsage("tache", t.id);
    const suite = apres.recurrence ? ` Prochaine fois ${decrireEcheance(apres.echeance, aujourdhui)}.` : "";
    setAnnulable({ texte: `« ${t.titre} » faite.${suite}`, avant: t });
  }

  async function annuler() {
    if (!annulable) return;
    await props.depot.enregistrerTache(annulable.avant);
    setAnnulable(null);
  }

  // Une tâche unique déjà faite redevient à faire ; elle garde sa date.
  const refaire = (t: Tache) => props.depot.enregistrerTache({ ...t, faiteLe: null, faitePar: null });

  async function supprimer(t: Tache) {
    await props.depot.supprimerTache(t.id);
    setASupprimer(null);
    setOuverte(null);
    setAnnulable({ texte: `« ${t.titre} » supprimée.`, avant: t });
  }

  // Les six tâches arrivent déjà étalées sur la semaine, pas toutes le même jour.
  const ajouterSemaine = () => {
    const nouvelles = tachesDeDepart(aujourdhui, contexteReel);
    const etalees = new Map(appliquerEtalement(etalementPropose(nouvelles, aujourdhui)).map((x) => [x.id, x]));
    return props.depot.enregistrerTaches(nouvelles.map((x) => etalees.get(x.id) ?? x));
  };

  // La chose du moment, en grand : la première tâche du groupe qui presse le plus.
  const phare = groupes[0]?.taches.find((t) => !estTerminee(t))?.id ?? null;

  function ligne(t: Tache) {
    const terminee = estTerminee(t);
    const resp = membre(t.responsable);
    const enRetard = !terminee && t.echeance < aujourdhui;
    const details = [
      decrireRecurrence(t.recurrence),
      terminee ? `faite${membre(t.faitePar) ? ` par ${membre(t.faitePar)!.prenom}` : ""}` : decrireEcheance(t.echeance, aujourdhui),
      resp ? `${resp.id === moi ? "toi" : resp.prenom}` : plusieurs ? "libre" : null,
    ].filter(Boolean);

    return (
      <li key={t.id} className={t.id === phare ? "phare-ligne" : undefined}>
        <Glissable
          onSupprimer={() => void supprimer(t)}
          onFait={terminee ? undefined : () => void faire(t)}
          libelleFait="Faite"
          onAppuiLong={() => {
            setOuverte(t.id);
            setASupprimer(null);
          }}
        >
        <div className={`ligne tache${terminee ? " coche" : ""}`}>
          <button
            className="case"
            onClick={() => (terminee ? refaire(t) : faire(t))}
            aria-label={terminee ? `Remettre « ${t.titre} » à faire` : `Marquer « ${t.titre} » comme faite`}
          >
            {terminee ? "✓" : ""}
          </button>
          <button
            className="tache-texte"
            onClick={() => {
              setOuverte(t.id);
              setASupprimer(null);
            }}
            aria-haspopup="dialog"
          >
            <span className="ligne-texte">{t.titre}</span>
            <span className={`tache-details${enRetard ? " retard" : ""}`}>{details.join(" · ")}</span>
          </button>
          {resp && plusieurs && resp.id !== moi && (
            <span className="initiale" style={{ background: resp.couleur }} title={`S'en occupe : ${resp.prenom}`}>
              {resp.prenom.charAt(0)}
            </span>
          )}
        </div>
        </Glissable>
      </li>
    );
  }

  const vide = props.taches.length === 0;

  const t = props.taches.find((x) => x.id === ouverte);
  const etalement = etalementPropose(props.taches, aujourdhui);
  const dues = groupes.filter((g) => g.cle === "retard" || g.cle === "aujourdhui").reduce((n, g) => n + g.taches.length, 0);
  const autre = props.foyer.membres.find((m) => m.id !== moi);
  return (
    <Page
      titre="Tâches"
      sousTitre={vide ? undefined : dues ? `${dues} à faire aujourd'hui` : "Rien ne presse aujourd'hui"}
      actions={plusieurs && !vide ? <button className="lien" onClick={() => setRepartir(true)}>Répartir</button> : undefined}
      aide={{ cle: "taches", texte: "Dis une tâche à ta fée, avec son rythme : « linge chaque mercredi ». Glisse une tâche vers la droite quand elle est faite, vers la gauche pour la supprimer. Un appui long ouvre sa fiche." }}
    >
      <Repartition ouverte={repartir} fermer={() => setRepartir(false)} foyer={props.foyer} taches={props.taches} aujourdhui={aujourdhui} depot={props.depot} />

      <Feuille ouverte={!!t} onFermer={() => setOuverte(null)} titre={t?.titre}>
        {t && (
          <div className="formulaire tache-feuille">
            <p className="discret">{decrireRecurrence(t.recurrence)}</p>
            {!estTerminee(t) && (
              <label>
                {t.recurrence ? "Prochaine fois le" : "Pour le"}
                <input type="date" value={t.echeance} min="2000-01-01" onChange={(e) => e.target.value && props.depot.enregistrerTache({ ...t, echeance: e.target.value })} />
              </label>
            )}
            {moi && t.responsable !== moi && (
              <button type="button" className="bouton-principal" onClick={() => props.depot.enregistrerTache(prendre(t, moi))}>
                Je m'en occupe
              </button>
            )}
            {autre && t.responsable !== autre.id && (
              <button type="button" className="secondaire" onClick={() => props.depot.enregistrerTache(prendre(t, autre.id))}>
                Donner à {autre.prenom}
              </button>
            )}
            {t.responsable !== null && (
              <button type="button" className="lien" onClick={() => props.depot.enregistrerTache(liberer(t))}>
                Rendre libre
              </button>
            )}
            {aSupprimer === t.id ? (
              <button type="button" className="lien danger" onClick={() => { setOuverte(null); void supprimer(t); }}>
                Confirmer la suppression
              </button>
            ) : (
              <button type="button" className="lien danger" onClick={() => setASupprimer(t.id)}>
                Supprimer
              </button>
            )}
          </div>
        )}
      </Feuille>


      {!vide && <Onglets libelle="Afficher" onglets={FILTRES.filter((f) => f.id !== "miennes" || moi)} actif={filtre} changer={setFiltre} />}

      {etalement.length > 0 && (
        <button className="carte proposition" onClick={() => void props.depot.enregistrerTaches(appliquerEtalement(etalement))}>
          <span className="pictogramme"><Icone nom="calendrier" taille={20} /></span>
          <span className="proposition-texte">
            <strong>Étaler sur la semaine</strong>
            <span className="discret">Plusieurs tâches tombent le même jour : Kora les pose sur des jours différents.</span>
          </span>
          <Icone nom="suivant" taille={18} />
        </button>
      )}

      {!vide && equilibreVisible(props.foyer) && <CarteEquilibre foyer={props.foyer} taches={props.taches} aujourdhui={aujourdhui} />}

      {vide && (
        <div className="carte bientot">
          <p>Aucune tâche pour l'instant.</p>
          <p className="discret">Les tâches de la semaine que vous avez choisies : {TACHES_DE_LA_SEMAINE.join(", ")}. Kora les pose sur six jours différents.</p>
          <button className="bouton-principal" onClick={ajouterSemaine}>Ajouter ces 6 tâches</button>
        </div>
      )}

      {!vide && groupes.length === 0 && terminees.length === 0 && (
        <p className="vide">{filtre === "miennes" ? "Tu ne t'occupes d'aucune tâche." : "Aucune tâche libre."}</p>
      )}

      {groupes.map((g) => (
        <section key={g.cle}>
          <h2 className={`rayon${g.cle === "retard" ? " retard" : ""}`}>{g.titre}</h2>
          <ul className="carte groupe">{g.taches.map(ligne)}</ul>
        </section>
      ))}

      {terminees.length > 0 && (
        <section>
          <div className="entete-coches">
            <h2 className="rayon">Faites ({terminees.length})</h2>
            <button className="lien" onClick={() => terminees.forEach((t) => props.depot.supprimerTache(t.id))}>
              Effacer
            </button>
          </div>
          <ul className="carte groupe">{terminees.map(ligne)}</ul>
        </section>
      )}

      {annulable && (
        <div className="toast" role="status">
          <span>{annulable.texte}</span>
          <button className="lien" onClick={annuler}>Annuler</button>
        </div>
      )}
    </Page>
  );
}

/** Le dimanche : Kora propose qui fait quoi cette semaine, à parts égales ; chacun change d'un toucher. */
function Repartition(props: { ouverte: boolean; fermer: () => void; foyer: Foyer; taches: Tache[]; aujourdhui: string; depot: Depot }) {
  const [choix, setChoix] = useState<Map<string, string | null>>(new Map());
  useEffect(() => {
    if (props.ouverte) setChoix(new Map(proposerRepartition(props.taches, props.foyer, props.aujourdhui)));
  }, [props.ouverte]); // eslint-disable-line react-hooks/exhaustive-deps
  const semaine = tachesDeLaSemaine(props.taches, props.aujourdhui);
  const membres = props.foyer.membres;
  const suivant = (actuel: string | null | undefined) => {
    const i = actuel ? membres.findIndex((m) => m.id === actuel) : -1;
    return i + 1 < membres.length ? membres[i + 1].id : null;
  };
  async function valider() {
    const changees = appliquerRepartition(props.taches, choix);
    if (changees.length) await props.depot.enregistrerTaches(changees);
    noterRepartition(props.aujourdhui);
    vibrer();
    props.fermer();
  }
  return (
    <Feuille ouverte={props.ouverte} onFermer={props.fermer} titre="On se répartit la semaine ?" fermer="Plus tard">
      {semaine.length === 0 ? (
        <p className="discret">Rien à répartir cette semaine.</p>
      ) : (
        <>
          <p className="discret">Kora propose à parts égales, en alternant avec la dernière fois. Touche un prénom pour changer. {compteRepartition(choix, props.foyer)}.</p>
          <ul className="carte groupe">
            {semaine.map((t) => {
              const qui = membres.find((m) => m.id === choix.get(t.id));
              return (
                <li key={t.id} className="ligne">
                  <span className="ligne-texte">
                    {t.titre}
                    <span className="tache-details">{decrireEcheance(t.echeance, props.aujourdhui)}</span>
                  </span>
                  <button className="puce" onClick={() => setChoix((c) => new Map(c).set(t.id, suivant(c.get(t.id))))}>
                    {qui ? <><span className="initiale petite" style={{ background: qui.couleur }}>{qui.prenom.charAt(0)}</span>{qui.prenom}</> : "Libre"}
                  </button>
                </li>
              );
            })}
          </ul>
          <button className="bouton-principal" onClick={() => void valider()}>C'est d'accord</button>
        </>
      )}
    </Feuille>
  );
}

/** Qui a fait quoi ce mois-ci : une barre partagée et une phrase douce, jamais un classement. */
function CarteEquilibre(props: { foyer: Foyer; taches: Tache[]; aujourdhui: string }) {
  const { parMembre, phrase } = equilibreDesTaches(props.taches, props.foyer, props.aujourdhui);
  const total = parMembre.reduce((s, m) => s + m.fois, 0);
  return (
    <section className="carte equilibre" aria-label="L'équilibre des tâches">
      <p className="surtitre">Ce mois-ci</p>
      {total > 0 && (
        <div className="equilibre-barre" aria-hidden>
          {parMembre.map((m) => (
            <span key={m.membreId} style={{ flexGrow: m.fois, background: m.couleur }} />
          ))}
        </div>
      )}
      <p className="equilibre-noms">
        {parMembre.map((m) => (
          <span key={m.membreId}>
            <span className="equilibre-point" style={{ background: m.couleur }} aria-hidden />
            {m.prenom} · {m.fois}
          </span>
        ))}
      </p>
      <p className="discret">{phrase}</p>
    </section>
  );
}
