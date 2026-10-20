import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  analyserPhrase,
  CATEGORIES,
  decrireDans,
  decrireHoraire,
  decrireJour,
  dispositionDuJour,
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
import { Onglets, Page, useGestionnaireBarre } from "../pieces";
import { comprendrePhrase } from "../../domaine/barre";
import { deuxChiffres } from "../../domaine/texte";

type Vue = "jour" | "semaine" | "mois" | "avenir";
const VUES: Record<Vue, string> = { jour: "Jour", semaine: "Semaine", mois: "Mois", avenir: "À venir" };
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
  const [vue, setVue] = useState<Vue>("semaine");
  const [filtre, setFiltre] = useState<Filtre>("tout");
  const [choisi, setChoisi] = useState<Jour>(aujourdhui);
  const [ouvert, setOuvert] = useState<Occurrence | null>(null);
  const [edition, setEdition] = useState<{ avant: Evenement | null; jour: Jour; heure?: string } | null>(null);

  const lundi = lundiDe(choisi);
  const mois = choisi.slice(0, 7);
  const grille = useMemo(() => grilleDuMois(mois), [mois]);
  const [du, au] =
    vue === "jour" ? [choisi, choisi] : vue === "mois" ? [grille[0], grille[grille.length - 1]] : vue === "semaine" ? [lundi, plus(lundi, 6)] : [aujourdhui, plus(aujourdhui, JOURS_A_VENIR)];
  const occ = useMemo(
    () => filtrer(occurrences(evenements, vue === "avenir" ? du : choisi < du ? choisi : du, vue === "avenir" ? au : choisi > au ? choisi : au, p.animaux), filtre),
    [evenements, p.animaux, du, au, choisi, filtre, vue],
  );

  const deplacer = (sens: -1 | 1) => {
    vibrer();
    if (vue === "mois") setChoisi(`${decaler(`${mois}-01`, { unite: "mois", tous: sens }).slice(0, 7)}-01`);
    else setChoisi(plus(choisi, (vue === "jour" ? 1 : 7) * sens));
  };

  async function retirer(e: Evenement) {
    setOuvert(null);
    // Venu d'un calendrier iCloud : le serveur doit d'abord l'y effacer, sinon il reviendrait.
    if (e.icloud) await depot.enregistrerAgenda({ ...e, aRetirer: true, modifieLe: contexteReel.maintenant() });
    else await depot.supprimerAgenda(e.id);
    synchroniserBientot(p.agendaDistant);
    annoncer(`« ${e.titre} » retiré de l'agenda.`, async () => {
      await depot.enregistrerAgenda(e);
      synchroniserBientot(p.agendaDistant);
    });
  }

  // Ce qu'on écrit dans la barre arrive au jour choisi quand la phrase ne dit pas le jour.
  useGestionnaireBarre("module:agenda", async (texte) => {
    const i = comprendrePhrase(texte, "agenda", aujourdhui, foyer.membres);
    if (i.type !== "agenda") return false;
    const b = i.brouillon;
    const jour = b.jour ?? (choisi < aujourdhui ? aujourdhui : choisi);
    const ev = preparerEvenement({ titre: b.titre, jour, fin: b.fin, heure: b.heure, heureFin: b.heureFin, categorie: b.categorie, repetition: b.repetition, pour: b.pour }, p.membreId, contexteReel);
    await depot.enregistrerAgenda(ev);
    vibrer();
    setChoisi(ev.jour);
    synchroniserBientot(p.agendaDistant);
    annoncer(`« ${ev.titre} » ajouté, ${decrireJour(ev.jour, aujourdhui).toLowerCase()}${ev.heure ? ` à ${ev.heure}` : ""}.`, async () => {
      await depot.supprimerAgenda(ev.id);
      synchroniserBientot(p.agendaDistant);
    });
    return true;
  });

  // Entre les flèches : le mois (ou le jour) affiché ; le toucher ramène à aujourd'hui.
  const libelleNav = vue === "jour" ? decrireJour(choisi, aujourdhui) : nomDuMois(vue === "semaine" ? plus(lundi, 3).slice(0, 7) : mois);
  const navigation = (precedent: string, suivant: string) => (
    <div className="agenda-nav">
      <button className="bouton-icone" onClick={() => deplacer(-1)} aria-label={precedent}>
        <Icone nom="retour" />
      </button>
      <button className="agenda-nav-titre" onClick={() => setChoisi(aujourdhui)} aria-label={`${libelleNav}, revenir à aujourd'hui`}>
        {libelleNav}
      </button>
      <button className="bouton-icone" onClick={() => deplacer(1)} aria-label={suivant}>
        <Icone nom="suivant" />
      </button>
    </div>
  );

  const filtres: Record<string, string> = { tout: "Tout", nous: "Nous deux", ...Object.fromEntries(foyer.membres.map((m) => [m.id, m.prenom])) };

  return (
    <Page
      titre="Agenda"
      sousTitre={vue === "avenir" ? `Les ${JOURS_A_VENIR} prochains jours` : undefined}
      aide={{ cle: "agenda", texte: "Dis-le à ta fée comme tu le dirais (un appui long sur elle pour l'écrire) : « Dentiste jeudi 14h30 », « Vacances du 20 au 27 décembre ». Sans jour, l'événement va au jour choisi. Touche le mois entre les flèches pour revenir à aujourd'hui." }}
      className="agenda"
    >
      <Onglets libelle="Vue" onglets={(Object.keys(VUES) as Vue[]).map((v) => ({ id: v, libelle: VUES[v] }))} actif={vue} changer={setVue} />
      <Puces libelle="Pour qui" valeur={filtre} choix={filtres} changer={setFiltre} />

      {vue === "jour" && <div className="agenda-nav-jour">{navigation("Jour précédent", "Jour suivant")}</div>}

      {(vue === "semaine" || vue === "mois") && (
        <section className="carte agenda-calendrier">
          {navigation(vue === "mois" ? "Mois précédent" : "Semaine précédente", vue === "mois" ? "Mois suivant" : "Semaine suivante")}
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
                  {vue === "mois" ? (
                    // Le mois montre les titres, comme Calendrier : deux au plus, puis « +n ».
                    <span className="agenda-titres" aria-hidden>
                      {ce.slice(0, ce.length > 2 ? 1 : 2).map((o) => (
                        <span key={o.cle} className="agenda-mini" style={{ ["--couleur" as string]: couleurDe(foyer, o.evenement.pour) }}>
                          {o.evenement.titre}
                        </span>
                      ))}
                      {ce.length > 2 && <span className="agenda-plus">+{ce.length - 1}</span>}
                    </span>
                  ) : (
                    <span className="agenda-points" aria-hidden>
                      {ce.slice(0, 3).map((o) => (
                        <span key={o.cle} style={{ background: couleurDe(foyer, o.evenement.pour) }} />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {vue === "avenir" ? (
        <AVenir occ={occ} aujourdhui={aujourdhui} foyer={foyer} ouvrir={setOuvert} />
      ) : vue === "jour" ? (
        <VueJour
          occ={occ}
          jour={choisi}
          aujourdhui={aujourdhui}
          foyer={foyer}
          ouvrir={setOuvert}
          ajouter={(heure) => setEdition({ avant: null, jour: choisi, heure })}
        />
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
            {ouvert.lectureSeule || (ouvert.evenement.icloud && ouvert.evenement.creePar !== p.membreId) ? (
              <p className="discret">Vient de : {ouvert.evenement.source}. {ouvert.lectureSeule ? "Il se modifie là-bas." : "Seul son propriétaire peut le modifier depuis Kora."}</p>
            ) : (
              <>
                <button type="button" className="bouton-principal" onClick={() => { const e = ouvert.evenement; setOuvert(null); setEdition({ avant: e, jour: e.jour }); }}>
                  Modifier
                </button>
                <button type="button" className="lien danger" onClick={() => void retirer(ouvert.evenement)}>
                  {ouvert.evenement.repetition === "aucune" ? "Retirer" : "Retirer toute la série"}
                </button>
                {ouvert.evenement.icloud && <p className="discret">Vient de : {ouvert.evenement.source}. Ce que tu changes ici y retourne aussi.</p>}
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

      <button className="lien agenda-lien-iphone" onClick={p.ouvrirCalendrier}>Calendrier de l'iPhone</button>
    </Page>
  );
}

const HAUTEUR_HEURE = 52;
const HEURES = Array.from({ length: 24 }, (_, h) => h);
const maintenantEnMinutes = () => {
  const d = new Date(contexteReel.maintenant());
  return d.getHours() * 60 + d.getMinutes();
};

/** La journée heure par heure, comme dans Calendrier : toucher une heure libre y ajoute un événement. */
function VueJour(props: { occ: Occurrence[]; jour: Jour; aujourdhui: Jour; foyer: Foyer; ouvrir: (o: Occurrence) => void; ajouter: (heure: string) => void }) {
  const { journee, places } = useMemo(() => dispositionDuJour(props.occ, props.jour), [props.occ, props.jour]);
  const defilement = useRef<HTMLDivElement>(null);
  const estAujourdhui = props.jour === props.aujourdhui;
  const [maintenant, setMaintenant] = useState(maintenantEnMinutes);

  useEffect(() => {
    if (!estAujourdhui) return;
    const minuteur = setInterval(() => setMaintenant(maintenantEnMinutes()), 60_000);
    return () => clearInterval(minuteur);
  }, [estAujourdhui]);

  // On arrive sur l'heure qui compte : maintenant, le premier rendez-vous, ou 8 h.
  const premier = places[0]?.debut;
  useEffect(() => {
    const cible = estAujourdhui ? maintenantEnMinutes() - 60 : (premier ?? 8 * 60) - 30;
    defilement.current?.scrollTo({ top: Math.max(0, (cible / 60) * HAUTEUR_HEURE) });
  }, [props.jour, estAujourdhui, premier]);

  return (
    <section className="agenda-jour-vue">
      <h2 className="rayon">{decrireJour(props.jour, props.aujourdhui)}</h2>
      {journee.length > 0 && (
        <ul className="agenda-journee" aria-label="Toute la journée">
          {journee.map((o) => (
            <li key={o.cle}>
              <button className="agenda-bloc journee" style={{ ["--couleur" as string]: couleurDe(props.foyer, o.evenement.pour) }} onClick={() => props.ouvrir(o)} aria-haspopup="dialog">
                <span className="agenda-bloc-titre">{titreDe(o)}</span>
                {o.fin !== o.debut && <span className="agenda-bloc-heure">{decrireHoraire(o)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="carte agenda-heures" ref={defilement}>
        <div className="agenda-heures-contenu" style={{ height: 24 * HAUTEUR_HEURE }}>
          {HEURES.map((h) => (
            <button
              key={h}
              className="agenda-creneau"
              style={{ top: h * HAUTEUR_HEURE, height: HAUTEUR_HEURE }}
              onClick={() => props.ajouter(`${deuxChiffres(h)}:00`)}
              aria-label={`Ajouter à ${h} h`}
            >
              <span className="agenda-creneau-heure">{h === 0 ? "" : `${deuxChiffres(h)}:00`}</span>
            </button>
          ))}
          {places.map((p) => {
            const e = p.occurrence.evenement;
            const hauteur = ((p.fin - p.debut) / 60) * HAUTEUR_HEURE;
            return (
              <button
                key={p.occurrence.cle}
                className={`agenda-bloc${hauteur < 40 ? " court" : ""}`}
                style={{
                  top: (p.debut / 60) * HAUTEUR_HEURE,
                  height: hauteur - 2,
                  left: `calc(var(--marge-heures) + (100% - var(--marge-heures)) * ${p.colonne / p.colonnes})`,
                  width: `calc((100% - var(--marge-heures)) / ${p.colonnes} - 3px)`,
                  ["--couleur" as string]: couleurDe(props.foyer, e.pour),
                }}
                onClick={() => props.ouvrir(p.occurrence)}
                aria-haspopup="dialog"
                aria-label={`${titreDe(p.occurrence)}, ${decrireHoraire(p.occurrence)}`}
              >
                <span className="agenda-bloc-titre">{titreDe(p.occurrence)}</span>
                {!(hauteur < 40 && p.colonnes > 1) && (
                  <span className="agenda-bloc-heure">{[e.heureFin ? `${e.heure} – ${e.heureFin}` : e.heure, e.lieu].filter(Boolean).join(" · ")}</span>
                )}
              </button>
            );
          })}
          {estAujourdhui && (
            <div className="agenda-maintenant" style={{ top: (maintenant / 60) * HAUTEUR_HEURE }} aria-hidden>
              <span>{`${deuxChiffres(Math.floor(maintenant / 60))}:${deuxChiffres(maintenant % 60)}`}</span>
            </div>
          )}
        </div>
      </div>
      {!places.length && !journee.length && <p className="discret agenda-astuce">Rien de prévu. Touche une heure pour y ajouter quelque chose.</p>}
    </section>
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
  if (!jours.length) return <p className="vide agenda-vide">Rien de prévu pour l'instant. Dis-le à ta fée, par exemple « Dentiste jeudi 14h ».</p>;
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

const champsDe = (e: Evenement | null, jour: Jour, heure?: string): Champs => ({
  titre: e?.titre ?? "",
  jour: e?.jour ?? jour,
  fin: e?.fin ?? null,
  journee: e ? !e.heure : false,
  heure: e?.heure ?? heure ?? "09:00",
  heureFin: e?.heureFin ?? "",
  pour: e?.pour ?? null,
  categorie: e?.categorie ?? "autre",
  repetition: e?.repetition ?? "aucune",
  lieu: e?.lieu ?? "",
  note: e?.note ?? "",
});

function Edition(props: {
  ouverte: boolean;
  edition: { avant: Evenement | null; jour: Jour; heure?: string } | null;
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
  const [details, setDetails] = useState(false);
  const [derniere, setDerniere] = useState<typeof props.edition>(null);
  if (props.edition !== derniere) {
    setDerniere(props.edition);
    if (props.edition) {
      setPhrase("");
      setC(champsDe(props.edition.avant, props.edition.jour, props.edition.heure));
      setPlusieursJours(!!props.edition.avant?.fin);
      setDetails(!!props.edition.avant);
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
            <input value={phrase} onChange={(e) => lirePhrase(e.target.value)} placeholder="Dentiste 14h30, vacances jusqu'au 27" autoComplete="off" enterKeyHint="done" />
          </label>
        )}
        {!details && (
          <>
            {c.titre.trim() && (
              <p className="agenda-compris">
                <strong>{c.titre}</strong>
                <span className="discret">
                  {" "}· {decrireJour(c.jour, props.aujourdhui)}
                  {plusieursJours && c.fin ? ` au ${decrireJour(c.fin, props.aujourdhui).toLowerCase()}` : ""}
                  {c.journee ? ", toute la journée" : ` à ${c.heure}${c.heureFin ? ` – ${c.heureFin}` : ""}`}
                  {c.pour ? ` · ${prenomDe(props.foyer, c.pour)}` : ""}
                </span>
              </p>
            )}
            <button type="button" className="lien" onClick={() => setDetails(true)}>Plus de détails</button>
          </>
        )}
        {details && (
        <>
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
        </>
        )}
        {erreur && <p className="erreur">{erreur}</p>}
        <button type="submit" className="bouton-principal" disabled={!c.titre.trim()}>
          {avant ? "Enregistrer" : "Ajouter à l'agenda"}
        </button>
      </form>
    </Feuille>
  );
}
