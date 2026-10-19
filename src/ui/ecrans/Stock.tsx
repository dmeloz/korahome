import { lazy, Suspense, useState } from "react";
import type { ServeurJarvis } from "../../donnees/distant";
import type { DonneesModule } from "../modules";
import { TicketDeCaisse } from "../TicketDeCaisse";
import { Feuille } from "../Feuille";
import {
  apprendre,
  decrireDuree,
  DUREES,
  decrireGaspillage,
  habituelsARemettre,
  noterFin,
  ordonnerCatalogue,
  souventJete,
  produitDepuisHabituel,
  proposer,
  suggerer,
  trouverHabituel,
  type ProduitHabituel,
} from "../../domaine/catalogue";
import { ErreurValidation } from "../../domaine/foyer";
import { nouvelElement, trouverDoublon } from "../../domaine/listes";
import { adresseFiche, lireFiche, type FicheProduit } from "../../domaine/openFoodFacts";
import { comprendreSaisie } from "../../domaine/saisieStock";
import {
  ajuster,
  avecQuantite,
  calendrierDates,
  creerProduit,
  datesRapides,
  decrirePeremption,
  decrireQuantite,
  deplacer,
  etatProduit,
  fraicheur,
  LIEUX,
  nommerJour,
  ORDRE_LIEUX,
  ORDRE_UNITES,
  organiserStock,
  pasDe,
  quantiteDe,
  resumeStock,
  UNITES,
  type Lieu,
  type Produit,
  type Unite,
} from "../../domaine/stock";
import { decaler } from "../../domaine/taches";
import type { Element, Jour, Liste } from "../../domaine/types";
import type { Depot } from "../../donnees/depot";
import { useAnnoncer } from "../annulation";
import { contexteReel } from "../contexte";
import { Glissable } from "../Glissable";
import { Icone } from "../Icone";
import { AuDessusDeLaBarre, Onglets, Page, useGestionnaireBarre, useSaisieBarre } from "../pieces";

// Frigo, congélateur et placard : ce qu'il y a à la maison, ce qui arrive à sa date
// en tête. On ajoute d'une phrase (tapée ou dictée), d'un scan ou d'un toucher sur un
// produit habituel ; la Base retient tout seule où on range chaque produit et combien
// de temps il se garde. Ce qui est fini part d'un toucher sur la liste de courses.

const Scanner = lazy(() => import("../Scanner"));

type Vue = "stock" | "dates" | "base";

/** Change de vue avec un fondu, quand l'iPhone sait le faire. */
function enTransition(changer: () => void) {
  const doc = document as Document & { startViewTransition?: (f: () => void) => unknown };
  if (doc.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) doc.startViewTransition(changer);
  else changer();
}

export function Stock(props: {
  depot: Depot;
  membreId: string | null;
  produits: Produit[];
  catalogue: ProduitHabituel[];
  listes: Liste[];
  elements: Element[];
  aujourdhui: Jour;
  /** Pour lire un ticket de caisse entier avec Jarvis, quand le foyer est partagé. */
  jarvis?: { serveur: ServeurJarvis; foyerId: string } | null;
  donnees?: DonneesModule;
}) {
  const { aujourdhui, depot, catalogue } = props;
  const [vue, setVue] = useState<Vue>("stock");
  const [filtre, setFiltre] = useState<Lieu | "tous">("tous");
  // La phrase s'écrit dans la barre Jarvis ; la page la complète (combien, où, jusqu'à quand).
  const { texte: saisie, changer: setSaisie } = useSaisieBarre();
  // Ce que la personne a choisi elle-même ; undefined : on suit ce que Kora a compris.
  const [lieuChoisi, setLieuChoisi] = useState<Lieu | undefined>();
  const [dateChoisie, setDateChoisie] = useState<Jour | null | undefined>();
  const [nombreChoisi, setNombreChoisi] = useState<number | null | undefined>();
  const [uniteChoisie, setUniteChoisie] = useState<Unite | undefined>();
  const [fiche, setFiche] = useState<FicheProduit | null>(null);
  const [scanner, setScanner] = useState(false);
  const [recherche, setRecherche] = useState(false);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const produitOuvert = props.produits.find((p) => p.id === ouvert);
  const [message, setMessage] = useState<string | null>(null);
  const annoncer = useAnnoncer();
  const courses = props.listes.find((l) => l.type === "courses");

  // Ce que Kora comprend de la saisie, complété par la fiche scannée et les habitudes.
  const compris = saisie.trim() ? comprendreSaisie(saisie, aujourdhui) : null;
  const proposition = compris?.nom ? proposer(catalogue, compris.nom) : null;
  const dateProposee = proposition?.dureeJours ? decaler(aujourdhui, { unite: "jour", tous: proposition.dureeJours }) : null;
  const lieu: Lieu = lieuChoisi ?? compris?.lieu ?? fiche?.lieu ?? proposition?.lieu ?? (filtre === "tous" ? "frigo" : filtre);
  const peremption = dateChoisie !== undefined ? dateChoisie : (compris?.peremption ?? dateProposee);
  const nombre = nombreChoisi !== undefined ? nombreChoisi : (compris?.nombre ?? fiche?.nombre ?? proposition?.nombre ?? null);
  const unite: Unite | null = nombre === null ? null : (uniteChoisie ?? compris?.unite ?? fiche?.unite ?? proposition?.unite ?? "piece");
  const suggestions = compris ? suggerer(catalogue, compris.nom) : [];
  const resume = resumeStock(props.produits, aujourdhui);

  function viderSaisie() {
    setSaisie("");
    setLieuChoisi(undefined);
    setDateChoisie(undefined);
    setNombreChoisi(undefined);
    setUniteChoisie(undefined);
    setFiche(null);
  }

  /** Enregistre le produit et ce que la Base en apprend ; « Annuler » défait les deux. */
  async function entrer(p: Produit, phrase: string) {
    const avant = trouverHabituel(catalogue, p.nom, p.code);
    const habituel = apprendre(catalogue, p, aujourdhui, contexteReel);
    await depot.enregistrerProduit(p);
    await depot.enregistrerHabituel(habituel);
    annoncer(phrase, async () => {
      await depot.supprimerProduit(p.id);
      if (avant) await depot.enregistrerHabituel(avant);
      else await depot.supprimerHabituel(habituel.id);
    });
  }

  /** La barre envoie la phrase : le produit entre au stock tel que la page l'a compris. */
  async function ajouter(): Promise<boolean> {
    if (!compris?.nom) return false;
    try {
      const p = creerProduit({ nom: compris.nom, nombre, unite, lieu, peremption, code: fiche?.code ?? null, image: fiche?.image ?? null }, props.membreId, contexteReel);
      await entrer(p, `« ${p.nom} » ajouté ${a(p.lieu)}.`);
      viderSaisie();
      setMessage(null);
    } catch (err) {
      if (err instanceof ErreurValidation) setMessage(err.message);
      else throw err;
    }
    return true;
  }
  // Une question (« qu'est-ce qui périme ? ») n'est pas un produit : la barre la confie à Jarvis.
  useGestionnaireBarre("module:stock", (phrase) => (/\?\s*$|^(qu|est-ce|combien|quand|quel)/i.test(phrase.trim()) ? Promise.resolve(false) : ajouter()));

  async function remettre(h: ProduitHabituel) {
    const p = produitDepuisHabituel(h, aujourdhui, props.membreId, contexteReel);
    await entrer(p, `« ${p.nom} » remis ${a(p.lieu)}.`);
  }

  /** Un code-barres lu : la Base le connaît peut-être déjà, sinon Open Food Facts. */
  async function codeLu(code: string) {
    setScanner(false);
    setMessage(null);
    const connu = catalogue.find((h) => h.code === code);
    if (connu) {
      setFiche({ code, nom: connu.nom, nombre: connu.nombre, unite: connu.unite, lieu: connu.lieu, image: connu.image });
      setSaisie(connu.nom);
      return;
    }
    setRecherche(true);
    try {
      const reponse = await fetch(adresseFiche(code), { signal: AbortSignal.timeout(8000) });
      const lue = reponse.ok ? lireFiche(code, await reponse.json()) : null;
      if (lue) {
        setFiche(lue);
        setSaisie(lue.nom);
      } else {
        setFiche({ code, nom: "", nombre: null, unite: null, lieu: null, image: null });
        setMessage("Ce produit n'est pas encore sur Open Food Facts. Écris son nom : Kora le reconnaîtra au prochain scan.");
      }
    } catch {
      setFiche({ code, nom: "", nombre: null, unite: null, lieu: null, image: null });
      setMessage("Pas de réseau pour lire la fiche. Écris le nom : Kora retiendra ce code.");
    } finally {
      setRecherche(false);
    }
  }

  /**
   * Kora retient comment le produit a quitté le stock : jeté parce que sa date était passée,
   * ou fini. Ce qui finit souvent périmé est signalé au bilan et sur la liste de courses.
   * Rend de quoi l'oublier si on annule.
   */
  async function noterSortie(p: Produit, jete: boolean): Promise<() => Promise<void>> {
    const h = trouverHabituel(catalogue, p.nom, p.code);
    if (!h) return async () => {};
    await depot.enregistrerHabituel(noterFin(h, jete));
    return () => depot.enregistrerHabituel(h);
  }

  async function supprimer(p: Produit) {
    await depot.supprimerProduit(p.id);
    const jete = etatProduit(p, aujourdhui) === "perime";
    const defaire = await noterSortie(p, jete);
    setOuvert(null);
    const h = trouverHabituel(catalogue, p.nom, p.code);
    const suite = jete && h && souventJete(noterFin(h, true)) ? ` Il finit souvent périmé (${decrireGaspillage(noterFin(h, true))}) : à acheter en plus petite quantité.` : "";
    annoncer(`« ${p.nom} » retiré.${suite}`, async () => {
      await defaire();
      await depot.enregistrerProduit(p);
    });
  }

  /** Fini : il quitte le stock et rejoint la liste de courses, sauf s'il y est déjà. */
  async function aRacheter(p: Produit) {
    if (!courses) return supprimer(p);
    const siens = props.elements.filter((e) => e.listeId === courses.id);
    const deja = trouverDoublon(siens, p.nom);
    const element = deja ? null : nouvelElement(courses, p.nom, props.membreId, contexteReel);
    if (element) await depot.enregistrerElement(element);
    await depot.supprimerProduit(p.id);
    const defaire = await noterSortie(p, false);
    setOuvert(null);
    annoncer(deja ? `« ${p.nom} » est fini, il est déjà sur la liste de courses.` : `« ${p.nom} » est fini, ajouté aux courses.`, async () => {
      if (element) await depot.supprimerElements([element.id]);
      await defaire();
      await depot.enregistrerProduit(p);
    });
  }

  /** − ou + sur un produit ; le dernier pris, il part sur la liste de courses. */
  async function changerQuantite(p: Produit, sens: 1 | -1) {
    const suivant = ajuster(p, sens);
    if (suivant) await depot.enregistrerProduit(suivant);
    else await aRacheter(p);
  }

  function ligne(p: Produit, montrerLieu: boolean) {
    const etat = etatProduit(p, aujourdhui);
    const date = decrirePeremption(p, aujourdhui);
    const { nombre: n, unite: u } = quantiteDe(p);
    const details = [montrerLieu ? LIEUX[p.lieu] : null, date].filter(Boolean);
    const reste = fraicheur(p, aujourdhui);
    return (
      <li key={p.id}>
        <Glissable onSupprimer={() => void supprimer(p)} libelle="Retirer">
          <div className="ligne produit">
            <button className="produit-corps" onClick={() => setOuvert(p.id)} aria-haspopup="dialog">
              {p.image ? (
                <img className="vignette" src={p.image} alt="" loading="lazy" />
              ) : (
                <span className={`vignette sans-photo etat-${etat}`} aria-hidden>
                  {p.nom.charAt(0)}
                </span>
              )}
              <span className="ligne-texte produit-texte">
                <span className="produit-nom">{p.nom}</span>
                {details.length > 0 && (
                  <span className={`tache-details${etat === "perime" || etat === "aujourdhui" ? " retard" : ""}`}>{details.join(" · ")}</span>
                )}
                {reste !== null && (
                  <span className={`fraicheur etat-${etat}`} aria-hidden>
                    <span style={{ width: `${Math.max(4, reste * 100)}%` }} />
                  </span>
                )}
              </span>
            </button>
            <span className="pas-a-pas" role="group" aria-label={`Quantité de ${p.nom}`}>
              <button onClick={() => void changerQuantite(p, -1)} aria-label="Un de moins">
                <Icone nom="moins" taille={16} />
              </button>
              <span className="pas-valeur">{decrireQuantite(n ?? 1, u ?? "piece")}</span>
              <button onClick={() => void changerQuantite(p, 1)} aria-label="Un de plus">
                <Icone nom="ajouter" taille={16} />
              </button>
            </span>
          </div>
        </Glissable>
      </li>
    );
  }

  const composer = (
    <div className="composer">
      <div className="composer-outils">
        <button type="button" className="carte outil-ajout" onClick={() => setScanner(true)} disabled={recherche}>
          <Icone nom="codeBarres" taille={20} />
          <span>Scanner</span>
        </button>
        {props.donnees && props.jarvis && (
          <span className="carte outil-ajout">
            <TicketDeCaisse jarvis={props.jarvis} donnees={props.donnees} depot={depot} catalogue={catalogue} classe="outil-ticket" />
            <span>Ticket</span>
          </span>
        )}
      </div>
      {recherche && <p className="discret composer-aide">Lecture de la fiche du produit…</p>}

      <AuDessusDeLaBarre>
      {suggestions.length > 0 && (
        <div className="puces suggestions" role="group" aria-label="Produits habituels">
          {suggestions.map((h) => (
            <button type="button" key={h.id} className="puce" onClick={() => setSaisie(h.nom)}>
              {h.nom}
            </button>
          ))}
        </div>
      )}

      {compris?.nom && (
        <div className="compris carte">
          {fiche?.image && <img className="compris-photo" src={fiche.image} alt="" />}
          <div className="compris-ligne">
            <span className="compris-titre">Combien</span>
            <span className="pas-a-pas grand">
              <button type="button" aria-label="Moins" onClick={() => setNombreChoisi(nombre === null ? null : Math.max(0, nombre - pasDe(unite, nombre, -1)) || null)}>
                <Icone nom="moins" taille={16} />
              </button>
              <span className="pas-valeur">{nombre === null ? "—" : decrireQuantite(nombre, unite)}</span>
              <button type="button" aria-label="Plus" onClick={() => setNombreChoisi(nombre === null ? 1 : Math.round((nombre + pasDe(unite, nombre, 1)) * 100) / 100)}>
                <Icone nom="ajouter" taille={16} />
              </button>
            </span>
            {nombre !== null && (
              <span className="puces unites">
                {ORDRE_UNITES.map((u) => (
                  <button type="button" key={u} className={`puce petite${u === unite ? " active" : ""}`} aria-pressed={u === unite} onClick={() => setUniteChoisie(u)}>
                    {UNITES[u]}
                  </button>
                ))}
              </span>
            )}
          </div>
          <div className="compris-ligne">
            <span className="compris-titre">Où</span>
            <span className="puces">
              {ORDRE_LIEUX.map((l) => (
                <button type="button" key={l} className={`puce${l === lieu ? " active" : ""}`} aria-pressed={l === lieu} onClick={() => setLieuChoisi(l)}>
                  {LIEUX[l]}
                </button>
              ))}
            </span>
          </div>
          <div className="compris-ligne">
            <span className="compris-titre">Jusqu'au</span>
            <span className="puces">
              <button type="button" className={`puce${peremption === null ? " active" : ""}`} aria-pressed={peremption === null} onClick={() => setDateChoisie(null)}>
                Sans date
              </button>
              {peremption && !datesRapides(aujourdhui).some((d) => d.jour === peremption) && (
                <button type="button" className="puce active" aria-pressed>
                  {nommerJour(peremption, aujourdhui)}
                </button>
              )}
              {datesRapides(aujourdhui).map((d) => (
                <button type="button" key={d.libelle} className={`puce${peremption === d.jour ? " active" : ""}`} aria-pressed={peremption === d.jour} onClick={() => setDateChoisie(d.jour)}>
                  {d.libelle}
                </button>
              ))}
              <label className="puce puce-date">
                Autre
                <input type="date" value={peremption ?? ""} min={aujourdhui} onChange={(e) => setDateChoisie(e.target.value || null)} aria-label="Autre date" />
              </label>
            </span>
          </div>
          {proposition && (
            <p className="discret proposition-kora">
              {proposition.source === "habitude" ? "D'après vos habitudes" : "Kora propose"} : {LIEUX[proposition.lieu].toLowerCase()}
              {proposition.dureeJours ? `, se garde ${decrireDuree(proposition.dureeJours)}` : ""}.
            </p>
          )}
        </div>
      )}
      </AuDessusDeLaBarre>
    </div>
  );

  const aRemettre = habituelsARemettre(catalogue, props.produits);
  const groupes = organiserStock(props.produits, aujourdhui, filtre);
  const jours = calendrierDates(props.produits, aujourdhui);

  return (
    <Page
      titre="Frigo et placards"
      className="page-stock"
      sousTitre={props.produits.length > 0 ? `${props.produits.length} produit${props.produits.length > 1 ? "s" : ""}${resume.aConsommer.length ? ` · ${resume.aConsommer.length} à consommer` : " · rien ne presse"}` : undefined}
      aide={{ cle: "stock", texte: "Écris à ta fée (un appui long sur elle), « 6 œufs frigo jusqu'au 25 » : la quantité, le lieu et la date se remplissent pendant que tu écris. Scanner lit un code-barres, Ticket range un ticket de caisse entier." }}
    >
      <Onglets
        libelle="Vue"
        onglets={[{ id: "stock", libelle: "Stock" }, { id: "dates", libelle: "Dates" }, { id: "base", libelle: "Base" }] as const}
        actif={vue}
        changer={(v) => enTransition(() => setVue(v))}
      />

      {vue === "stock" && (
        <>
          {composer}
          {message && <p className="erreur" role="status">{message}</p>}

          {!saisie.trim() && aRemettre.length > 0 && (
            <section className="a-remettre">
              <h2 className="rayon">À remettre d'un toucher</h2>
              <div className="defilant">
                {aRemettre.map((h) => (
                  <button key={h.id} className="habituel" onClick={() => void remettre(h)}>
                    {h.image ? <img src={h.image} alt="" /> : <span className="habituel-initiale">{h.nom.charAt(0)}</span>}
                    <span className="habituel-nom">{h.nom}</span>
                    <span className="habituel-detail">{[decrireQuantite(h.nombre, h.unite), LIEUX[h.lieu]].filter(Boolean).join(" · ")}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {props.produits.length > 0 && (
            <div className="puces filtres" role="group" aria-label="Afficher">
              {(["tous", ...ORDRE_LIEUX] as const).map((f) => (
                <button key={f} className={`puce${f === filtre ? " active" : ""}`} aria-pressed={f === filtre} onClick={() => setFiltre(f)}>
                  {f === "tous" ? "Tout" : LIEUX[f]}
                </button>
              ))}
            </div>
          )}

          {props.produits.length === 0 && (
            <div className="carte bientot">
              <p>Le frigo est vide pour l'instant.</p>
              <p className="discret">
                Écris « 6 œufs frigo » ou scanne un code-barres. Kora devine où ça se range et combien de temps ça se garde, puis
                retient vos habitudes dans la Base.
              </p>
            </div>
          )}
          {props.produits.length > 0 && groupes.length === 0 && <p className="vide">Rien ici.</p>}

          {groupes.map((g) => (
            <section key={g.cle}>
              <h2 className={`rayon${g.cle === "aConsommer" ? " retard" : ""}`}>{g.titre}</h2>
              <ul className="carte groupe">{g.produits.map((p) => ligne(p, g.cle === "aConsommer" && filtre === "tous"))}</ul>
            </section>
          ))}

          {props.produits.length > 0 && <p className="discret indice">− et + changent la quantité. Glisse vers la gauche pour retirer.</p>}
        </>
      )}

      {vue === "dates" && (
        <>
          {jours.length === 0 && <p className="vide">Aucune date à surveiller.</p>}
          {jours.map((j) => (
            <section key={j.cle}>
              <h2 className={`rayon${j.urgent ? " retard" : ""}`}>{j.titre}</h2>
              <ul className="carte groupe">{j.produits.map((p) => ligne(p, true))}</ul>
            </section>
          ))}
          {props.produits.some((p) => !p.peremption) && (
            <p className="discret indice">Les produits sans date restent dans la vue Stock.</p>
          )}
        </>
      )}

      {vue === "base" && <Base depot={depot} catalogue={catalogue} remettre={remettre} />}

      {scanner && (
        <Suspense fallback={null}>
          <Scanner trouve={(code) => void codeLu(code)} fermer={() => setScanner(false)} />
        </Suspense>
      )}
      <Feuille ouverte={!!produitOuvert} onFermer={() => setOuvert(null)} titre={produitOuvert?.nom}>
        {produitOuvert && (
          <div className="formulaire produit-feuille">
            <p className="discret">
              {[LIEUX[produitOuvert.lieu], decrirePeremption(produitOuvert, aujourdhui)].filter(Boolean).join(" · ")}
            </p>
            <div className="puces" role="group" aria-label="Où le ranger">
              {ORDRE_LIEUX.map((l) => (
                <button
                  key={l}
                  type="button"
                  className={`puce${l === produitOuvert.lieu ? " active" : ""}`}
                  aria-pressed={l === produitOuvert.lieu}
                  onClick={() => void depot.enregistrerProduit(deplacer(produitOuvert, l))}
                >
                  {LIEUX[l]}
                </button>
              ))}
            </div>
            <label>
              À consommer avant le
              <input type="date" value={produitOuvert.peremption ?? ""} onChange={(e) => void depot.enregistrerProduit(avecQuantite({ ...produitOuvert, peremption: e.target.value || null }))} />
            </label>
            {courses && (
              <button type="button" className="bouton-principal" onClick={() => { const pr = produitOuvert; setOuvert(null); void aRacheter(pr); }}>
                Fini, à racheter
              </button>
            )}
            <button type="button" className="lien danger" onClick={() => { const pr = produitOuvert; setOuvert(null); void supprimer(pr); }}>
              Retirer du stock
            </button>
          </div>
        )}
      </Feuille>
    </Page>
  );
}

const a = (l: Lieu) => (l === "placard" ? "au placard" : l === "frigo" ? "au frigo" : "au congélateur");

/** La Base : chaque produit habituel, où il se range et combien de temps il se garde. */
function Base(props: { depot: Depot; catalogue: ProduitHabituel[]; remettre: (h: ProduitHabituel) => Promise<void> }) {
  const [ouvert, setOuvert] = useState<string | null>(null);
  const annoncer = useAnnoncer();
  const tous = ordonnerCatalogue(props.catalogue);

  if (tous.length === 0) {
    return (
      <div className="carte bientot">
        <p>La Base se remplit toute seule.</p>
        <p className="discret">
          Chaque produit ajouté au stock y entre avec son lieu, sa quantité et sa durée de conservation. La prochaine fois, Kora
          les propose, et il se remet d'un toucher.
        </p>
      </div>
    );
  }

  const changer = (h: ProduitHabituel, modif: Partial<ProduitHabituel>) => void props.depot.enregistrerHabituel({ ...h, ...modif });

  return (
    <>
      <ul className="carte groupe">
        {tous.map((h) => {
          const estOuvert = ouvert === h.id;
          const details = [LIEUX[h.lieu], decrireQuantite(h.nombre, h.unite), h.dureeJours ? `se garde ${decrireDuree(h.dureeJours)}` : null].filter(Boolean);
          return (
            <li key={h.id}>
              <Glissable
                onSupprimer={() => {
                  void props.depot.supprimerHabituel(h.id);
                  annoncer(`« ${h.nom} » retiré de la Base.`, () => props.depot.enregistrerHabituel(h));
                }}
              >
                <button className="ligne produit" onClick={() => setOuvert(h.id)} aria-haspopup="dialog">
                  {h.image ? <img className="vignette" src={h.image} alt="" loading="lazy" /> : <span className="vignette sans-photo" aria-hidden>{h.nom.charAt(0)}</span>}
                  <span className="ligne-texte produit-texte">
                    <span className="produit-nom">{h.nom}</span>
                    <span className="tache-details">{details.join(" · ")}</span>
                  </span>
                  <span className="compteur" title="Fois ajouté">{h.fois}×</span>
                </button>
              </Glissable>
              <Feuille ouverte={estOuvert} onFermer={() => setOuvert(null)} titre={h.nom}>
                <div className="reglage-habituel">
                  <div className="puces">
                    {ORDRE_LIEUX.map((l) => (
                      <button key={l} className={`puce petite${l === h.lieu ? " active" : ""}`} aria-pressed={l === h.lieu} onClick={() => changer(h, { lieu: l })}>
                        {LIEUX[l]}
                      </button>
                    ))}
                  </div>
                  <div className="puces">
                    {DUREES.map((d) => (
                      <button
                        key={d.libelle}
                        className={`puce petite${d.jours === h.dureeJours ? " active" : ""}`}
                        aria-pressed={d.jours === h.dureeJours}
                        onClick={() => changer(h, { dureeJours: d.jours })}
                      >
                        {d.libelle}
                      </button>
                    ))}
                  </div>
                  <button className="bouton-principal" onClick={() => { setOuvert(null); void props.remettre(h); }}>Remettre au stock</button>
                </div>
              </Feuille>
            </li>
          );
        })}
      </ul>
      <p className="discret indice">Touche un produit pour changer son lieu ou sa durée. Glisse vers la gauche pour l'oublier.</p>
    </>
  );
}
