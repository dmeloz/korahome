import { useMemo, useState, type FormEvent } from "react";
import {
  analyserPhrase,
  CATEGORIES,
  comptesIcloudDe,
  decrireDans,
  decrireHoraire,
  decrireJour,
  duJour,
  evenementsDe,
  filtrer,
  grilleDuMois,
  lundiDe,
  nomDuMois,
  occurrences,
  preparerEvenement,
  REPETITIONS,
  titreDe,
  type Categorie,
  type CompteIcloud,
  type Evenement,
  type Filtre,
  type Occurrence,
  type Repetition,
} from "../../domaine/agenda";
import { ErreurValidation } from "../../domaine/foyer";
import { decaler } from "../../domaine/taches";
import type { Foyer, Id, Jour } from "../../domaine/types";
import type { ServeurAgenda } from "../../donnees/distant";
import { useAnnoncer } from "../annulation";
import { contexteReel } from "../contexte";
import { Feuille } from "../Feuille";
import { vibrer } from "../haptique";
import { Icone } from "../Icone";
import type { PropsPage } from "../modules";

type Vue = "semaine" | "mois" | "avenir";
const VUES: Record<Vue, string> = { semaine: "Semaine", mois: "Mois", avenir: "À venir" };
const INITIALES = ["L", "M", "M", "J", "V", "S", "D"];
const JOURS_A_VENIR = 60;
const plus = (j: Jour, n: number) => decaler(j, { unite: "jour", tous: n });

type Distant = { serveur: ServeurAgenda; foyerId: string } | null;

/** Après une modification, l'iPhone suit : la synchro iCloud passe quelques secondes plus tard. */
let attente: ReturnType<typeof setTimeout> | null = null;
function synchroniserBientot(distant: Distant) {
  if (!distant) return;
  if (attente) clearTimeout(attente);
  attente = setTimeout(() => void distant.serveur.synchroniserAgenda(distant.foyerId).catch(() => {}), 5000);
}

const couleurDe = (foyer: Foyer, pour: Id | null) => (pour ? (foyer.membres.find((m) => m.id === pour)?.couleur ?? "var(--discret)") : "var(--accent)");
const prenomDe = (foyer: Foyer, pour: Id | null) => (pour ? (foyer.membres.find((m) => m.id === pour)?.prenom ?? "") : "Nous deux");

function Puces<T extends string>(props: { valeur: T; choix: Record<T, string>; changer: (v: T) => void; libelle: string }) {
  return (
    <div className="puces" role="group" aria-label={props.libelle}>
      {(Object.keys(props.choix) as T[]).map((v) => (
        <button type="button" key={v} className={`puce${v === props.valeur ? " active" : ""}`} aria-pressed={v === props.valeur} onClick={() => props.changer(v)}>
          {props.choix[v]}
        </button>
      ))}
    </div>
  );
}

/** L'agenda commun : la semaine, le mois ou ce qui vient, pour nous deux ou pour l'un de nous. */
export function Agenda(p: PropsPage) {
  const { foyer, aujourdhui, depot } = p;
  const annoncer = useAnnoncer();
  const docs = p.agenda;
  const evenements = useMemo(() => evenementsDe(docs), [docs]);
  const comptes = useMemo(() => comptesIcloudDe(docs), [docs]);
  const [vue, setVue] = useState<Vue>("semaine");
  const [filtre, setFiltre] = useState<Filtre>("tout");
  const [choisi, setChoisi] = useState<Jour>(aujourdhui);
  const [ouvert, setOuvert] = useState<Occurrence | null>(null);
  const [edition, setEdition] = useState<{ avant: Evenement | null; jour: Jour } | null>(null);

  const lundi = lundiDe(choisi);
  const mois = choisi.slice(0, 7);
  const grille = useMemo(() => grilleDuMois(mois), [mois]);
  const [du, au] = vue === "mois" ? [grille[0], grille[grille.length - 1]] : vue === "semaine" ? [lundi, plus(lundi, 6)] : [aujourdhui, plus(aujourdhui, JOURS_A_VENIR)];
  const occ = useMemo(
    () => filtrer(occurrences(evenements, vue === "avenir" ? du : choisi < du ? choisi : du, vue === "avenir" ? au : choisi > au ? choisi : au, p.animaux), filtre),
    [evenements, p.animaux, du, au, choisi, filtre, vue],
  );

  const deplacer = (sens: -1 | 1) => {
    vibrer();
    if (vue === "mois") setChoisi(`${decaler(`${mois}-01`, { unite: "mois", tous: sens }).slice(0, 7)}-01`);
    else setChoisi(plus(choisi, 7 * sens));
  };

  async function retirer(e: Evenement) {
    setOuvert(null);
    await depot.supprimerAgenda(e.id);
    synchroniserBientot(p.agendaDistant);
    annoncer(`« ${e.titre} » retiré de l'agenda.`, async () => {
      await depot.enregistrerAgenda(e);
      synchroniserBientot(p.agendaDistant);
    });
  }

  const filtres: Record<string, string> = { tout: "Tout", nous: "Nous deux", ...Object.fromEntries(foyer.membres.map((m) => [m.id, m.prenom])) };

  return (
    <main className="agenda">
      <p className="surtitre">{vue === "avenir" ? `Les ${JOURS_A_VENIR} prochains jours` : nomDuMois(vue === "semaine" ? plus(lundi, 3).slice(0, 7) : mois)}</p>
      <div className="entete-coches">
        <h1>Agenda</h1>
        <button className="lien" onClick={() => setEdition({ avant: null, jour: choisi < aujourdhui ? aujourdhui : choisi })}>Ajouter</button>
      </div>

      <div className="segments" role="tablist">
        {(Object.keys(VUES) as Vue[]).map((v) => (
          <button key={v} role="tab" aria-selected={vue === v} className={vue === v ? "actif" : ""} onClick={() => setVue(v)}>
            {VUES[v]}
          </button>
        ))}
      </div>
      <Puces libelle="Pour qui" valeur={filtre} choix={filtres} changer={setFiltre} />

      {vue !== "avenir" && (
        <section className="carte agenda-calendrier">
          <div className="agenda-nav">
            <button className="bouton-icone" onClick={() => deplacer(-1)} aria-label={vue === "mois" ? "Mois précédent" : "Semaine précédente"}>
              <Icone nom="retour" />
            </button>
            <button className="lien" onClick={() => setChoisi(aujourdhui)} disabled={choisi === aujourdhui}>Aujourd'hui</button>
            <button className="bouton-icone" onClick={() => deplacer(1)} aria-label={vue === "mois" ? "Mois suivant" : "Semaine suivante"}>
              <Icone nom="suivant" />
            </button>
          </div>
          <div className={`agenda-grille${vue === "mois" ? " mois" : ""}`}>
            {INITIALES.map((x, i) => (
              <span key={i} className="agenda-initiale" aria-hidden>{x}</span>
            ))}
            {(vue === "mois" ? grille : Array.from({ length: 7 }, (_, i) => plus(lundi, i))).map((j) => {
              const ce = duJour(occ, j);
              const hors = vue === "mois" && j.slice(0, 7) !== mois;
              return (
                <button
                  key={j}
                  className={`agenda-jour${j === choisi ? " choisi" : ""}${j === aujourdhui ? " aujourdhui" : ""}${hors ? " hors" : ""}`}
                  onClick={() => setChoisi(j)}
                  aria-label={`${decrireJour(j, aujourdhui)}, ${ce.length ? `${ce.length} événement${ce.length > 1 ? "s" : ""}` : "rien de prévu"}`}
                >
                  <span className="agenda-numero">{Number(j.slice(8, 10))}</span>
                  <span className="agenda-points" aria-hidden>
                    {ce.slice(0, 3).map((o) => (
                      <span key={o.cle} style={{ background: couleurDe(foyer, o.evenement.pour) }} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {vue === "avenir" ? (
        <AVenir occ={occ} aujourdhui={aujourdhui} foyer={foyer} ouvrir={setOuvert} />
      ) : (
        <section>
          <h2 className="rayon">{decrireJour(choisi, aujourdhui)}</h2>
          <JourneeListe occ={duJour(occ, choisi)} jour={choisi} foyer={foyer} ouvrir={setOuvert} vide="Rien de prévu ce jour-là." />
        </section>
      )}

      <Feuille ouverte={!!ouvert} onFermer={() => setOuvert(null)} titre={ouvert ? titreDe(ouvert) : undefined}>
        {ouvert && (
          <div className="formulaire agenda-detail">
            <p className="agenda-detail-quand">
              {decrireJour(ouvert.debut, aujourdhui)} · {decrireHoraire(ouvert)}
            </p>
            <p className="discret">
              <span className="agenda-pastille" style={{ background: couleurDe(foyer, ouvert.evenement.pour) }} aria-hidden />
              {prenomDe(foyer, ouvert.evenement.pour)} · {CATEGORIES[ouvert.evenement.categorie]}
              {ouvert.evenement.repetition !== "aucune" ? ` · ${REPETITIONS[ouvert.evenement.repetition].toLowerCase()}` : ""}
            </p>
            {ouvert.evenement.lieu && <p>{ouvert.evenement.lieu}</p>}
            {ouvert.evenement.note && <p className="discret agenda-note">{ouvert.evenement.note}</p>}
            {ouvert.lectureSeule ? (
              <p className="discret">Vient de : {ouvert.evenement.source}. Il se modifie là-bas.</p>
            ) : (
              <>
                <button type="button" className="bouton-principal" onClick={() => { const e = ouvert.evenement; setOuvert(null); setEdition({ avant: e, jour: e.jour }); }}>
                  Modifier
                </button>
                <button type="button" className="lien danger" onClick={() => void retirer(ouvert.evenement)}>
                  {ouvert.evenement.repetition === "aucune" ? "Retirer" : "Retirer toute la série"}
                </button>
              </>
            )}
          </div>
        )}
      </Feuille>

      <Edition
        ouverte={!!edition}
        edition={edition}
        fermer={() => setEdition(null)}
        foyer={foyer}
        membreId={p.membreId}
        aujourdhui={aujourdhui}
        enregistrer={async (e) => {
          await depot.enregistrerAgenda(e);
          vibrer();
          setChoisi(e.jour < aujourdhui && e.repetition !== "aucune" ? aujourdhui : e.jour);
          synchroniserBientot(p.agendaDistant);
        }}
      />

      <SectionIcloud foyer={foyer} membreId={p.membreId} comptes={comptes} distant={p.agendaDistant} />
    </main>
  );
}

function JourneeListe(props: { occ: Occurrence[]; jour: Jour; foyer: Foyer; ouvrir: (o: Occurrence) => void; vide: string }) {
  if (!props.occ.length) return <p className="vide agenda-vide">{props.vide}</p>;
  return (
    <ul className="carte groupe agenda-liste">
      {props.occ.map((o) => {
        const e = o.evenement;
        const enCours = o.debut < props.jour;
        const plusieursJours = o.fin !== o.debut;
        return (
          <li key={o.cle}>
            <button className="ligne agenda-ligne" onClick={() => props.ouvrir(o)} aria-haspopup="dialog">
              <span className="agenda-heure">
                {e.heure && o.debut === props.jour ? (
                  <>
                    <strong>{e.heure}</strong>
                    {e.heureFin && <span>{e.heureFin}</span>}
                  </>
                ) : (
                  <span>{enCours ? "En cours" : "Journée"}</span>
                )}
              </span>
              <span className="agenda-barre" style={{ background: couleurDe(props.foyer, e.pour) }} aria-hidden />
              <span className="agenda-texte">
                <span className="ligne-texte">{titreDe(o)}</span>
                <span className="tache-details">
                  {[e.pour ? prenomDe(props.foyer, e.pour) : null, e.lieu, plusieursJours ? decrireHoraire(o) : null, e.source].filter(Boolean).join(" · ") || CATEGORIES[e.categorie]}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function AVenir(props: { occ: Occurrence[]; aujourdhui: Jour; foyer: Foyer; ouvrir: (o: Occurrence) => void }) {
  // Ce qui revient chaque jour ou chaque semaine (le travail) n'apparaît qu'une fois : la suite est dans la semaine.
  const vus = new Set<string>();
  const occ = props.occ.filter((o) => {
    if (o.evenement.repetition !== "jour" && o.evenement.repetition !== "semaine") return true;
    if (vus.has(o.evenement.id)) return false;
    vus.add(o.evenement.id);
    return true;
  });
  const jours = [...new Set(occ.flatMap((o) => (o.debut < props.aujourdhui ? [props.aujourdhui] : [o.debut])))].sort();
  if (!jours.length) return <p className="vide agenda-vide">Rien de prévu pour l'instant. Touche Ajouter, ou écris « Dentiste jeudi 14h ».</p>;
  return (
    <>
      {jours.map((j) => (
        <section key={j}>
          <div className="entete-coches">
            <h2 className="rayon">{decrireJour(j, props.aujourdhui)}</h2>
            <span className="discret agenda-dans">{j === props.aujourdhui ? "" : decrireDans(j, props.aujourdhui)}</span>
          </div>
          <JourneeListe
            occ={occ.filter((o) => (o.debut < props.aujourdhui ? props.aujourdhui : o.debut) === j)}
            jour={j}
            foyer={props.foyer}
            ouvrir={props.ouvrir}
            vide=""
          />
        </section>
      ))}
    </>
  );
}

interface Champs {
  titre: string;
  jour: Jour;
  fin: Jour | null;
  journee: boolean;
  heure: string;
  heureFin: string;
  pour: Id | null;
  categorie: Categorie;
  repetition: Repetition;
  lieu: string;
  note: string;
}

const champsDe = (e: Evenement | null, jour: Jour): Champs => ({
  titre: e?.titre ?? "",
  jour: e?.jour ?? jour,
  fin: e?.fin ?? null,
  journee: e ? !e.heure : false,
  heure: e?.heure ?? "09:00",
  heureFin: e?.heureFin ?? "",
  pour: e?.pour ?? null,
  categorie: e?.categorie ?? "autre",
  repetition: e?.repetition ?? "aucune",
  lieu: e?.lieu ?? "",
  note: e?.note ?? "",
});

function Edition(props: {
  ouverte: boolean;
  edition: { avant: Evenement | null; jour: Jour } | null;
  fermer: () => void;
  foyer: Foyer;
  membreId: Id | null;
  aujourdhui: Jour;
  enregistrer: (e: Evenement) => Promise<void>;
}) {
  const [phrase, setPhrase] = useState("");
  const [c, setC] = useState<Champs>(() => champsDe(null, props.aujourdhui));
  const [erreur, setErreur] = useState<string | null>(null);
  const [plusieursJours, setPlusieursJours] = useState(false);
  const [derniere, setDerniere] = useState<typeof props.edition>(null);
  if (props.edition !== derniere) {
    setDerniere(props.edition);
    if (props.edition) {
      setPhrase("");
      setC(champsDe(props.edition.avant, props.edition.jour));
      setPlusieursJours(!!props.edition.avant?.fin);
      setErreur(null);
    }
  }
  const avant = props.edition?.avant ?? null;
  const changer = (x: Partial<Champs>) => setC((v) => ({ ...v, ...x }));

  function lirePhrase(texte: string) {
    setPhrase(texte);
    const b = analyserPhrase(texte, props.aujourdhui, props.foyer.membres);
    changer({
      titre: b.titre,
      ...(b.jour ? { jour: b.jour } : {}),
      fin: b.fin,
      ...(b.heure ? { journee: false, heure: b.heure, heureFin: b.heureFin ?? "" } : b.fin || b.categorie === "anniversaire" || b.categorie === "vacances" ? { journee: true } : {}),
      categorie: b.categorie,
      repetition: b.repetition,
      ...(b.pour !== undefined ? { pour: b.pour } : {}),
    });
    setPlusieursJours(!!b.fin);
  }

  async function valider(ev: FormEvent) {
    ev.preventDefault();
    try {
      const e = preparerEvenement(
        {
          titre: c.titre,
          jour: c.jour,
          fin: plusieursJours ? c.fin : null,
          heure: c.journee ? null : c.heure,
          heureFin: c.journee ? null : c.heureFin,
          pour: c.pour,
          categorie: c.categorie,
          repetition: c.repetition,
          lieu: c.lieu,
          note: c.note,
        },
        props.membreId,
        contexteReel,
        avant ?? undefined,
      );
      await props.enregistrer(e);
      props.fermer();
    } catch (err) {
      setErreur(err instanceof ErreurValidation ? err.message : "Impossible d'enregistrer, réessaie.");
    }
  }

  const pour: Record<string, string> = { nous: "Nous deux", ...Object.fromEntries(props.foyer.membres.map((m) => [m.id, m.prenom])) };
  return (
    <Feuille ouverte={props.ouverte} onFermer={props.fermer} titre={avant ? "Modifier" : "Nouvel événement"} fermer="Annuler">
      <form onSubmit={valider} className="formulaire agenda-formulaire">
        {!avant && (
          <label>
            Écris-le comme tu le dirais
            <input value={phrase} onChange={(e) => lirePhrase(e.target.value)} placeholder="Dentiste jeudi 14h30, vacances du 20 au 27 déc." autoComplete="off" autoFocus enterKeyHint="done" />
          </label>
        )}
        <label>
          Titre
          <input value={c.titre} onChange={(e) => changer({ titre: e.target.value })} placeholder="Véto de Mitsu" autoComplete="off" />
        </label>
        <div className="agenda-dates">
          <label>
            {plusieursJours ? "Du" : "Le"}
            <input type="date" value={c.jour} min="1900-01-01" onChange={(e) => e.target.value && changer({ jour: e.target.value, fin: c.fin && c.fin < e.target.value ? e.target.value : c.fin })} />
          </label>
          {plusieursJours && (
            <label>
              Au
              <input type="date" value={c.fin ?? c.jour} min={c.jour} onChange={(e) => e.target.value && changer({ fin: e.target.value })} />
            </label>
          )}
        </div>
        <button type="button" className="ligne chef-interrupteur" onClick={() => changer({ journee: !c.journee })} aria-pressed={c.journee}>
          <span className="ligne-texte">Toute la journée</span>
          <span className={`interrupteur${c.journee ? " actif" : ""}`} aria-hidden />
        </button>
        {!c.journee && (
          <div className="agenda-dates">
            <label>
              De
              <input type="time" value={c.heure} onChange={(e) => changer({ heure: e.target.value })} />
            </label>
            <label>
              À
              <input type="time" value={c.heureFin} onChange={(e) => changer({ heureFin: e.target.value })} />
            </label>
          </div>
        )}
        <button type="button" className="ligne chef-interrupteur" onClick={() => { setPlusieursJours(!plusieursJours); if (!c.fin) changer({ fin: plus(c.jour, 1) }); }} aria-pressed={plusieursJours}>
          <span className="ligne-texte">Sur plusieurs jours</span>
          <span className={`interrupteur${plusieursJours ? " actif" : ""}`} aria-hidden />
        </button>
        <Puces libelle="Pour qui" valeur={c.pour ?? "nous"} choix={pour} changer={(v) => changer({ pour: v === "nous" ? null : v })} />
        <Puces libelle="Genre" valeur={c.categorie} choix={CATEGORIES} changer={(v) => changer({ categorie: v, ...(v === "anniversaire" && c.repetition === "aucune" ? { repetition: "annee" as const, journee: true } : {}) })} />
        <Puces libelle="Répétition" valeur={c.repetition} choix={REPETITIONS} changer={(v) => changer({ repetition: v })} />
        <label>
          Lieu
          <input value={c.lieu} onChange={(e) => changer({ lieu: e.target.value })} placeholder="Facultatif" autoComplete="off" />
        </label>
        <label>
          Note
          <input value={c.note} onChange={(e) => changer({ note: e.target.value })} placeholder="Facultatif" autoComplete="off" />
        </label>
        {c.categorie === "anniversaire" && <p className="discret">Avec l'année de naissance dans la date, Kora affiche l'âge fêté.</p>}
        {erreur && <p className="erreur">{erreur}</p>}
        <button type="submit" className="bouton-principal" disabled={!c.titre.trim()}>
          {avant ? "Enregistrer" : "Ajouter à l'agenda"}
        </button>
      </form>
    </Feuille>
  );
}

const quand = (iso: string | null) => {
  if (!iso) return "pas encore synchronisé";
  const d = new Date(iso);
  return `synchronisé ${d.toDateString() === new Date().toDateString() ? "à" : `le ${d.toLocaleDateString("fr-CH", { day: "numeric", month: "short" })} à`} ${d.toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" })}`;
};

/** Relier son iCloud : l'agenda arrive dans l'app Calendrier, et l'iPhone revient dans Kora. */
function SectionIcloud(props: { foyer: Foyer; membreId: Id | null; comptes: CompteIcloud[]; distant: Distant }) {
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
      setErreur(e instanceof Error ? e.message : "Ça n'a pas marché, réessaie.");
    } finally {
      setEnCours(null);
    }
  }

  const d = props.distant;
  return (
    <section>
      <h2 className="rayon">Calendrier de l'iPhone</h2>
      <div className="carte agenda-icloud">
        {!d ? (
          <p className="discret">Active le partage du foyer dans les Réglages : l'agenda pourra alors se relier à l'iCloud de chacun.</p>
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
    </section>
  );
}
