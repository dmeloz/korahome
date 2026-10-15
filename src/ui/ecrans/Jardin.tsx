import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Feuille } from "../Feuille";
import { ErreurValidation } from "../../domaine/foyer";
import {
  ABRIS,
  TYPES_ZONE,
  ajouterPlante,
  arroser,
  calendrierDuMois,
  conseilDeSaison,
  decrireArrosage,
  decrireMalPlacee,
  especeDe,
  especesDuJardin,
  etatArrosage,
  gestesDuJardin,
  ideesDuMois,
  nouvellePlante,
  nouvelleZone,
  plantesMalPlacees,
  retirerPlante,
  type Abri,
  type TypeZone,
  type Zone,
} from "../../domaine/jardin";
import { aConfirmer, appliquerActions, decrireFoyer, lireActions, type Modification } from "../../domaine/jarvis";
import { decrireTemps, formaterPluie, formaterTemperatures, meteoDu, type JourMeteo } from "../../domaine/meteo";
import { EXPOSITIONS, NOMS_MOIS, type Espece, type Exposition } from "../../domaine/plantes";
import { useAnnoncer } from "../annulation";
import { contexteReel } from "../contexte";
import { Glissable } from "../Glissable";
import { vibrer } from "../haptique";
import { Icone } from "../Icone";
import { annulerModifications, enregistrerModifications, photoPourJarvis } from "../jarvis";
import type { PropsPage } from "../modules";

const enumerer = (mots: string[]) =>
  mots.length <= 1 ? (mots[0] ?? "") : `${mots.slice(0, -1).join(", ")} et ${mots[mots.length - 1]}`;

const nomDuJour = (jour: string, aujourdhui: string) =>
  jour === aujourdhui ? "Auj." : new Date(`${jour}T12:00:00`).toLocaleDateString("fr-CH", { weekday: "short" });

/** « Arrosage tous les 2 jours en été · craint le gel · vivace » */
function decrireEspece(x: Espece): string {
  return [
    `arrosage tous les ${x.arrosageJours} jours en été`,
    EXPOSITIONS[x.exposition].nom.toLowerCase(),
    x.gelive ? "craint le gel" : null,
    x.vivace ? "vivace" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function Section(props: { titre: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="entete-coches">
        <h2 className="rayon">{props.titre}</h2>
        {props.action}
      </div>
      {props.children}
    </section>
  );
}

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

const NOMS_EXPOSITION = Object.fromEntries(Object.entries(EXPOSITIONS).map(([k, v]) => [k, v.nom])) as Record<Exposition, string>;
const NOMS_ABRI = Object.fromEntries(Object.entries(ABRIS).map(([k, v]) => [k, v.nom])) as Record<Abri, string>;

export function Jardin(p: PropsPage) {
  const { depot, zones, meteo, aujourdhui, membreId } = p;
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [type, setType] = useState<TypeZone>("pot");
  const [exposition, setExposition] = useState<Exposition>("soleil");
  const [abri, setAbri] = useState<Abri>("dehors");
  const [erreur, setErreur] = useState<string | null>(null);
  const [idee, setIdee] = useState<Espece | null>(null);
  const annoncer = useAnnoncer();

  const mois = Number(aujourdhui.slice(5, 7));
  const jour = meteoDu(meteo, aujourdhui);
  const gestes = gestesDuJardin(zones, meteo, aujourdhui);
  const calendrier = calendrierDuMois(especesDuJardin(zones), mois);
  const idees = ideesDuMois(zones, mois);
  const conseil = conseilDeSaison(aujourdhui);

  async function enregistrer(zone: Zone, suite?: () => void) {
    try {
      await depot.enregistrerZone(zone);
      setErreur(null);
      suite?.();
    } catch {
      setErreur("Impossible d'enregistrer, réessaie.");
    }
  }

  function tenter(fabrique: () => Zone, suite?: () => void) {
    try {
      void enregistrer(fabrique(), suite);
    } catch (err) {
      setErreur(err instanceof ErreurValidation ? err.message : "Impossible d'enregistrer, réessaie.");
    }
  }

  function creerZone(e: FormEvent) {
    e.preventDefault();
    tenter(() => nouvelleZone({ nom, type, exposition, abri }, contexteReel), () => {
      setNom("");
      setOuvert(false);
    });
  }

  function arroserZone(zone: Zone) {
    vibrer();
    void enregistrer(arroser(zone, aujourdhui, membreId));
  }

  function supprimerZone(zone: Zone) {
    void depot.supprimerZone(zone.id).then(() => annoncer(`« ${zone.nom} » retirée du jardin.`, () => depot.enregistrerZone(zone)));
  }

  const ouvrirFormulaire = (nomPropose = "") => {
    setNom(nomPropose);
    setOuvert(true);
    setErreur(null);
  };

  return (
    <main>
      <p className="surtitre">{jour ? `${meteo?.lieu} · ${decrireTemps(jour.code)} · ${formaterTemperatures(jour)}` : "Renens"}</p>
      <h1>Jardin</h1>

      {meteo && <BandeMeteo jours={meteo.jours.filter((j) => j.jour >= aujourdhui).slice(0, 5)} aujourdhui={aujourdhui} />}

      {gestes.length > 0 && (
        <Section titre="Aujourd'hui">
          <ul className="carte groupe">
            {gestes.map((g) => {
              const zone = g.zoneId ? zones.find((z) => z.id === g.zoneId) : undefined;
              return (
                <li key={g.texte} className="ligne">
                  <span className={`ligne-texte${g.urgent ? " urgent-texte" : ""}`}>{g.texte}</span>
                  {zone && <button className="jardin-arroser" onClick={() => arroserZone(zone)}>Arrosé</button>}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      <Section titre="Zones" action={<button className="lien" onClick={() => ouvrirFormulaire()}>Ajouter</button>}>
        <Feuille ouverte={ouvert} onFermer={() => setOuvert(false)} titre="Nouvelle zone" fermer="Annuler">
          <form onSubmit={creerZone} className="formulaire jardin-formulaire">
            <label>
              Son nom
              <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Pots du balcon, grand bac…" autoComplete="off" autoFocus />
            </label>
            <Puces libelle="Contenant" valeur={type} choix={TYPES_ZONE} changer={setType} />
            <div>
              <Puces libelle="Soleil" valeur={exposition} choix={NOMS_EXPOSITION} changer={setExposition} />
              <p className="discret jardin-aide">{EXPOSITIONS[exposition].detail} par jour en été. L'app Shadowmap le montre heure par heure.</p>
            </div>
            <div>
              <Puces libelle="Abri" valeur={abri} choix={NOMS_ABRI} changer={setAbri} />
              <p className="discret jardin-aide">{ABRIS[abri].detail[0].toUpperCase() + ABRIS[abri].detail.slice(1)}.</p>
            </div>
            <button type="submit" className="bouton-principal" disabled={!nom.trim()}>Ajouter la zone</button>
          </form>
        </Feuille>
        {zones.length === 0 && (
          <div className="carte jardin-vide">
            <p className="discret">Une zone, c'est un pot, une jardinière ou un bac, avec le soleil qu'il reçoit. Kora dit quand arroser selon la pluie tombée, prévient du gel et propose quoi semer chaque mois.</p>
            <button className="bouton-principal" onClick={() => { setType("pot"); setExposition("soleil"); ouvrirFormulaire("Herbes aromatiques"); }}>
              Commencer par les pots d'herbes
            </button>
          </div>
        )}
        {zones.map((z) => (
          <CarteZone key={z.id} zone={z} {...p} enregistrer={enregistrer} tenter={tenter} arroser={() => arroserZone(z)} supprimer={() => supprimerZone(z)} />
        ))}
      </Section>

      {zones.length > 0 && <Reconnaitre {...p} />}

      <Section titre={`En ${NOMS_MOIS[mois - 1]}`}>
        <div className="carte jardin-calendrier">
          {conseil && <p className="jardin-conseil">{conseil}</p>}
          {[
            ["Semer au chaud", calendrier.semerAbri],
            ["Semer dehors", calendrier.semerDehors],
            ["Planter", calendrier.planter],
            ["Récolter", calendrier.recolter],
          ].map(([titre, liste]) =>
            (liste as Espece[]).length ? (
              <p key={titre as string}>
                <span className="jardin-etiquette">{titre as string}</span> {enumerer((liste as Espece[]).map((x) => x.nom.toLowerCase()))}
              </p>
            ) : null,
          )}
          {idees.length > 0 && (
            <>
              <p className="discret">Idées à semer ou planter ce mois-ci{zones.length ? ", selon le soleil de tes zones" : ""} :</p>
              <div className="puces">
                {idees.map((x) => (
                  <button key={x.cle} type="button" className={`puce${idee?.cle === x.cle ? " active" : ""}`} aria-pressed={idee?.cle === x.cle} onClick={() => setIdee(idee?.cle === x.cle ? null : x)}>
                    {x.nom}
                  </button>
                ))}
              </div>
              {idee && (
                <div className="jardin-idee">
                  <p><strong>{idee.nom}</strong> <span className="discret">· {decrireEspece(idee)}</span></p>
                  <p className="discret">{idee.conseil}</p>
                  {zones.length > 0 && (
                    <div className="puces">
                      {zones.map((z) => (
                        <button key={z.id} type="button" className="puce" onClick={() => tenter(() => ajouterPlante(z, nouvellePlante(idee.nom, aujourdhui, membreId, contexteReel)), () => setIdee(null))}>
                          + {z.nom}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </Section>

      {erreur && (
        <div className="toast" role="alert">
          <span>{erreur}</span>
          <button className="lien" onClick={() => setErreur(null)}>OK</button>
        </div>
      )}
    </main>
  );
}

function BandeMeteo({ jours, aujourdhui }: { jours: JourMeteo[]; aujourdhui: string }) {
  return (
    <ol className="carte jardin-meteo" aria-label="Météo des prochains jours">
      {jours.map((j) => {
        const pluie = formaterPluie(j.pluie);
        return (
          <li key={j.jour} className={j.min <= 2 ? "gel" : undefined}>
            <span className="jardin-meteo-jour">{nomDuJour(j.jour, aujourdhui)}</span>
            <strong>{Math.round(j.max)}°</strong>
            <span className="jardin-meteo-min">{Math.round(j.min)}°</span>
            <span className="jardin-meteo-pluie">{pluie ?? decrireTemps(j.code).replace("Grand soleil", "Soleil")}</span>
          </li>
        );
      })}
    </ol>
  );
}

function CarteZone(
  props: PropsPage & {
    zone: Zone;
    enregistrer: (z: Zone, suite?: () => void) => Promise<void>;
    tenter: (f: () => Zone, suite?: () => void) => void;
    arroser: () => void;
    supprimer: () => void;
  },
) {
  const { zone, meteo, aujourdhui, membreId } = props;
  const [plante, setPlante] = useState("");
  const [modifier, setModifier] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const annoncer = useAnnoncer();
  const etat = etatArrosage(zone, aujourdhui, meteo);
  const planteOuverte = zone.plantes.find((pl) => pl.id === detail);
  const especeOuverte = planteOuverte ? especeDe(planteOuverte) : undefined;
  const malPlacees = plantesMalPlacees(zone);

  function planter(e: FormEvent) {
    e.preventDefault();
    props.tenter(() => ajouterPlante(zone, nouvellePlante(plante, aujourdhui, membreId, contexteReel)), () => setPlante(""));
  }

  const retirer = (id: string, nom: string) => {
    const avant = zone;
    void props.enregistrer(retirerPlante(zone, id), () => annoncer(`« ${nom} » retiré.`, () => props.enregistrer(avant)));
  };

  return (
    <div className="carte jardin-zone">
      <div className="jardin-zone-entete">
        <div className="ligne-texte">
          <strong>{zone.nom}</strong>
          <span className="tache-details">
            {TYPES_ZONE[zone.type]} · {EXPOSITIONS[zone.exposition].nom} · {ABRIS[zone.abri].nom}
          </span>
        </div>
        <button className="lien" onClick={() => setModifier(true)}>Modifier</button>
      </div>

      {etat && (
        <div className="jardin-arrosage">
          <span className={etat.du ? "urgent-texte" : "discret"}>{decrireArrosage(etat, aujourdhui)}</span>
          {zone.arroseeLe !== aujourdhui && <button className="jardin-arroser" onClick={props.arroser}>Arrosé</button>}
        </div>
      )}

      {malPlacees.length > 0 && (
        <p className="jardin-conseil">
          {malPlacees.map(decrireMalPlacee).join(" ; ")}. Cette zone reçoit {EXPOSITIONS[zone.exposition].detail}.
        </p>
      )}

      {zone.plantes.length > 0 && (
        <ul className="groupe jardin-plantes">
          {zone.plantes.map((pl) => {
            const x = especeDe(pl);
            return (
              <li key={pl.id}>
                <Glissable className="jardin-plante" libelle="Retirer" onSupprimer={() => retirer(pl.id, pl.nom)}>
                  <button type="button" className="jardin-plante-nom" onClick={() => setDetail(pl.id)} aria-haspopup="dialog">
                    <strong>{pl.nom}</strong>
                    <span className="tache-details">{x ? decrireEspece(x) : "Kora ne la connaît pas encore : arrosage tous les 3 jours en été"}</span>
                  </button>
                </Glissable>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={planter} className="ajout">
        <input value={plante} onChange={(e) => setPlante(e.target.value)} placeholder="Ajouter une plante : basilic, menthe…" aria-label={`Ajouter une plante dans ${zone.nom}`} autoComplete="off" />
        <button type="submit" disabled={!plante.trim()} aria-label="Ajouter la plante">+</button>
      </form>

      <Feuille ouverte={detail !== null} onFermer={() => setDetail(null)} titre={planteOuverte?.nom}>
        {planteOuverte && (
          <>
            <p className="discret">
              {especeOuverte ? decrireEspece(especeOuverte) : "Kora ne connaît pas encore cette plante : elle compte un arrosage tous les 3 jours en été."}
            </p>
            {especeOuverte && <p className="jardin-plante-conseil">{especeOuverte.conseil}</p>}
            <p className="discret">Dans {zone.nom.toLowerCase()} depuis le {planteOuverte.depuis.split("-").reverse().join(".")}.</p>
            <button
              type="button"
              className="lien danger"
              onClick={() => {
                setDetail(null);
                retirer(planteOuverte.id, planteOuverte.nom);
              }}
            >
              Retirer cette plante
            </button>
          </>
        )}
      </Feuille>

      <Feuille ouverte={modifier} onFermer={() => setModifier(false)} titre={zone.nom}>
        <div className="formulaire jardin-modifier">
          <label>
            Nom
            <input defaultValue={zone.nom} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== zone.nom && props.enregistrer({ ...zone, nom: e.target.value.trim() })} autoComplete="off" />
          </label>
          <Puces libelle="Contenant" valeur={zone.type} choix={TYPES_ZONE} changer={(type) => props.enregistrer({ ...zone, type })} />
          <Puces libelle="Soleil" valeur={zone.exposition} choix={NOMS_EXPOSITION} changer={(exposition) => props.enregistrer({ ...zone, exposition })} />
          <Puces libelle="Abri" valeur={zone.abri} choix={NOMS_ABRI} changer={(abri) => props.enregistrer({ ...zone, abri })} />
          <button
            type="button"
            className="lien danger"
            onClick={() => {
              setModifier(false);
              props.supprimer();
            }}
          >
            Retirer cette zone
          </button>
        </div>
      </Feuille>
    </div>
  );
}

/** Une photo, et Jarvis dit de quelle plante il s'agit, puis l'ajoute à la zone choisie. */
function Reconnaitre(p: PropsPage) {
  const [zoneId, setZoneId] = useState(p.zones[0]?.id ?? "");
  const [enCours, setEnCours] = useState(false);
  const [reponse, setReponse] = useState<{ texte: string; modifications: Modification[]; annule?: boolean; erreur?: boolean } | null>(null);
  const choixPhoto = useRef<HTMLInputElement>(null);
  const zone = p.zones.find((z) => z.id === zoneId) ?? p.zones[0];

  async function envoyer(fichier: File | undefined) {
    if (!fichier || !p.jarvis || !zone) return;
    setEnCours(true);
    setReponse(null);
    try {
      const image = await photoPourJarvis(fichier);
      const r = await p.jarvis.serveur.demanderJarvis({
        foyerId: p.jarvis.foyerId,
        demande: `Quelle est cette plante ? Ajoute-la à la zone « ${zone.nom} ».`,
        etat: decrireFoyer(p, p.membreId, p.aujourdhui),
        historique: [],
        image,
      });
      // Ici, Jarvis reconnaît une plante : rien à supprimer ni à retenir sans question.
      const resultat = appliquerActions(lireActions(r.appels).filter((a) => !aConfirmer(a)), p, p.membreId, p.aujourdhui, contexteReel);
      await enregistrerModifications(p.depot, resultat.modifications);
      if (resultat.modifications.length) vibrer();
      setReponse({ texte: [r.texte, ...resultat.faits, ...resultat.echecs].filter(Boolean).join(" ") || "C'est fait.", modifications: resultat.modifications });
    } catch (e) {
      setReponse({ texte: e instanceof Error && e.message ? e.message : "Je n'ai pas pu regarder la photo, réessaie.", modifications: [], erreur: true });
    } finally {
      setEnCours(false);
    }
  }

  async function annuler() {
    if (!reponse || reponse.annule) return;
    await annulerModifications(p.depot, reponse.modifications);
    setReponse({ ...reponse, annule: true });
  }

  return (
    <Section titre="Reconnaître une plante">
      <div className="carte jardin-photo">
        {p.jarvis ? (
          <>
            <p className="discret">Prends la plante en photo : Jarvis la reconnaît, l'ajoute à la zone choisie et dit ce qu'il lui faut.</p>
            {p.zones.length > 1 && (
              <div className="puces" role="group" aria-label="Zone">
                {p.zones.map((z) => (
                  <button key={z.id} type="button" className={`puce${z.id === zone?.id ? " active" : ""}`} aria-pressed={z.id === zone?.id} onClick={() => setZoneId(z.id)}>
                    {z.nom}
                  </button>
                ))}
              </div>
            )}
            <button className="bouton-principal jardin-bouton-photo" disabled={enCours} onClick={() => choixPhoto.current?.click()}>
              <Icone nom="photo" taille={20} />
              {enCours ? "Jarvis regarde…" : "Prendre une photo"}
            </button>
            <input
              ref={choixPhoto}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                void envoyer(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {reponse && (
              <div className={`jardin-reponse${reponse.erreur ? " urgent-texte" : ""}`} role="status">
                <p>{reponse.annule ? "Annulé." : reponse.texte}</p>
                {reponse.modifications.length > 0 && !reponse.annule && <button className="lien" onClick={() => void annuler()}>Annuler</button>}
              </div>
            )}
          </>
        ) : (
          <p className="discret">La reconnaissance passe par Jarvis, qui a besoin du partage du foyer : active-le dans Réglages, Partage.</p>
        )}
      </div>
    </Section>
  );
}
