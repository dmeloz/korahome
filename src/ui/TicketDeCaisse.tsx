import { useRef, useState } from "react";
import { apprendre, type ProduitHabituel } from "../domaine/catalogue";
import { formaterMontant, planDe } from "../domaine/budget";
import { appliquerActions, decrireFoyer, lireActions, type DonneesFoyer } from "../domaine/jarvis";
import { decrireJour } from "../domaine/agenda";
import { decrirePeremption, LIEUX, ORDRE_LIEUX } from "../domaine/stock";
import { actionsDuTicket, lireTicket, paiementDuTicket, type TicketLu } from "../domaine/ticket";
import type { Depot } from "../donnees/depot";
import type { ServeurJarvis } from "../donnees/distant";
import { useAnnoncer } from "./annulation";
import { contexteReel } from "./contexte";
import { ChampMontant } from "./ecrans/budget/communs";
import { Feuille } from "./Feuille";
import { vibrer } from "./haptique";
import { Icone } from "./Icone";
import { annulerModifications, enregistrerModifications, pdfPourJarvis, photoPourJarvis } from "./jarvis";
import { nomFee } from "./fee";

// Le ticket de caisse en entier, depuis Frigo et placards, le Budget ou les Courses : une photo
// (ou le PDF du ticket numérique Migros, Coop), la fée lit chaque ligne, on vérifie (décocher,
// changer le lieu, corriger le total), puis tout se range d'un coup : le stock, la Base qui
// apprend chaque produit, les courses cochées et le total dans la carte courses du Budget.
// Rien ne s'enregistre avant « Tout ranger » ; Annuler défait le tout. Règles : domaine/ticket.ts.

const DEMANDE =
  "Voici un ticket de caisse. Range au stock tous les produits alimentaires et d'hygiène achetés (ajouter_au_stock), un par ligne du ticket, avec leur quantité dans le nom et le lieu où on les range d'habitude. Coche aussi les courses correspondantes (cocher_courses), et note le total payé au budget (noter_depense, pot courses, avec le magasin, la date du ticket et chaque ligne avec son prix dans articles).";

const estPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);

export function TicketDeCaisse(props: {
  jarvis: { serveur: ServeurJarvis; foyerId: string } | null;
  donnees: DonneesFoyer & { aujourdhui: string; membreId: string | null };
  depot: Depot;
  catalogue: ProduitHabituel[];
  /** La classe du bouton : dans la barre de la fée, il en prend l'allure. */
  classe?: string;
  /** Un mot à côté de l'icône (« Ticket »), pour un bouton visible dans une page. */
  libelle?: string;
  /** -1 quand le bouton est caché avec sa barre : VoiceOver et le clavier ne doivent pas l'atteindre. */
  tabIndex?: number;
}) {
  const { depot, donnees } = props;
  const choix = useRef<HTMLInputElement>(null);
  const annoncer = useAnnoncer();
  const [etat, setEtat] = useState<"ferme" | "lecture" | "verification" | "erreur">("ferme");
  const [pdf, setPdf] = useState(false);
  const [ticket, setTicket] = useState<TicketLu | null>(null);
  const [compterTotal, setCompterTotal] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  if (!props.jarvis) return null;
  const jarvis = props.jarvis;
  const avecBudget = !!planDe(donnees.budget ?? []);

  async function lire(fichier: File | undefined) {
    if (!fichier) return;
    const enPdf = estPdf(fichier);
    setPdf(enPdf);
    setEtat("lecture");
    setErreur(null);
    try {
      const image = enPdf ? await pdfPourJarvis(fichier) : await photoPourJarvis(fichier);
      const reponse = await jarvis.serveur.demanderJarvis({
        foyerId: jarvis.foyerId,
        demande: DEMANDE,
        etat: decrireFoyer(donnees, donnees.membreId, donnees.aujourdhui),
        historique: [],
        image,
      });
      const lu = lireTicket(lireActions(reponse.appels), props.catalogue, donnees.aujourdhui);
      if (!lu) {
        setErreur(reponse.texte || "Je n'ai pas trouvé de produits sur ce ticket. Essaie avec le ticket bien à plat et éclairé.");
        setEtat("erreur");
        return;
      }
      setTicket(avecBudget ? lu : { ...lu, total: null });
      setCompterTotal(true);
      setEtat("verification");
    } catch (e) {
      setErreur(e instanceof Error && e.message ? e.message : "Je n'ai pas pu lire le ticket, réessaie.");
      setEtat("erreur");
    }
  }

  async function ranger() {
    if (!ticket) return;
    const applique = appliquerActions(actionsDuTicket(ticket, compterTotal), donnees, donnees.membreId, donnees.aujourdhui, contexteReel);
    // Le total vient d'un ticket : marqué comme tel dans les dépenses du mois.
    const resultat = { ...applique, modifications: applique.modifications.map((m) => (m.collection === "budget" && !m.avant ? { ...m, apres: { ...m.apres, source: "ticket" as const } } : m)) };
    await enregistrerModifications(depot, resultat.modifications);
    // La Base apprend chaque produit, comme pour un ajout à la main.
    let catalogue = [...props.catalogue];
    const avantBase: (ProduitHabituel | null)[] = [];
    const appris: ProduitHabituel[] = [];
    for (const m of resultat.modifications) {
      if (m.collection !== "stock") continue;
      const habituel = apprendre(catalogue, m.apres, donnees.aujourdhui, contexteReel);
      avantBase.push(catalogue.find((h) => h.id === habituel.id) ?? null);
      appris.push(habituel);
      catalogue = [...catalogue.filter((h) => h.id !== habituel.id), habituel];
      await depot.enregistrerHabituel(habituel);
    }
    vibrer();
    setEtat("ferme");
    const n = ticket.produits.filter((p) => p.garder).length;
    const coches = resultat.modifications.filter((m) => m.collection === "elements").length;
    const total = ticket.total && compterTotal ? ticket.total : null;
    const phrases = [
      n ? `${n} produit${n > 1 ? "s" : ""} rangé${n > 1 ? "s" : ""}.` : "",
      coches ? `${coches} course${coches > 1 ? "s" : ""} cochée${coches > 1 ? "s" : ""}.` : "",
      total ? (paye ? `Paiement Apple Pay de ${formaterMontant(total.montant)} complété.` : `${formaterMontant(total.montant)} comptés dans les courses.`) : "",
    ];
    annoncer(phrases.filter(Boolean).join(" ") || "Ticket rangé.", async () => {
      await annulerModifications(depot, resultat.modifications);
      for (let i = appris.length - 1; i >= 0; i--) {
        const avant = avantBase[i];
        await (avant ? depot.enregistrerHabituel(avant) : depot.supprimerHabituel(appris[i].id));
      }
    });
  }

  const changer = (c: (t: TicketLu) => TicketLu) => setTicket((t) => (t ? c(t) : t));
  const basculer = (i: number) => changer((t) => ({ ...t, produits: t.produits.map((p, j) => (j === i ? { ...p, garder: !p.garder } : p)) }));
  const changerLieu = (i: number) =>
    changer((t) => ({ ...t, produits: t.produits.map((p, j) => (j === i ? { ...p, lieu: ORDRE_LIEUX[(ORDRE_LIEUX.indexOf(p.lieu) + 1) % ORDRE_LIEUX.length] } : p)) }));
  const basculerCourse = (i: number) => changer((t) => ({ ...t, courses: t.courses.map((c, j) => (j === i ? { ...c, garder: !c.garder } : c)) }));
  const changerTotal = (c: Partial<NonNullable<TicketLu["total"]>>) => changer((t) => (t.total ? { ...t, total: { ...t.total, ...c } } : t));

  const nombre = ticket?.produits.filter((p) => p.garder).length ?? 0;
  const total = ticket?.total ?? null;
  const paye = ticket ? paiementDuTicket(ticket, donnees.budget ?? []) : null;
  const titre = etat === "verification" ? "Sur le ticket" : "Ticket de caisse";

  return (
    <>
      <button
        type="button"
        className={props.classe ?? "bouton-scan"}
        onClick={() => choix.current?.click()}
        aria-label={props.libelle ? undefined : "Scanner un ticket de caisse"}
        disabled={etat === "lecture"}
        tabIndex={props.tabIndex}
      >
        <Icone nom="ticket" taille={props.libelle ? 20 : 22} />
        {props.libelle && <span>{props.libelle}</span>}
      </button>
      <input
        ref={choix}
        type="file"
        accept="image/*,application/pdf,.pdf"
        hidden
        onChange={(e) => {
          void lire(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Feuille ouverte={etat !== "ferme"} onFermer={() => setEtat("ferme")} titre={titre} fermer="Annuler">
        {etat === "lecture" && (
          <div className="ticket-lecture">
            <div className="bulle jarvis attente" aria-label={`${nomFee()} lit le ticket`}><span /><span /><span /></div>
            <p className="discret">{nomFee()} lit chaque ligne du ticket{pdf ? " dans le PDF" : ""}…</p>
          </div>
        )}
        {etat === "erreur" && <p className="discret">{erreur}</p>}
        {etat === "verification" && ticket && (
          <>
            {ticket.produits.length > 0 && (
              <>
                <p className="discret">Décoche ce qui ne va pas au stock ; touche le lieu pour le changer.</p>
                <ul className="carte groupe ticket-lignes">
                  {ticket.produits.map((p, i) => {
                    const date = decrirePeremption(p, donnees.aujourdhui);
                    return (
                      <li key={i} className={`ligne${p.garder ? "" : " coche"}`}>
                        <button type="button" className="case" onClick={() => basculer(i)} aria-pressed={p.garder} aria-label={`Ranger ${p.nom}`}>
                          {p.garder ? "✓" : ""}
                        </button>
                        <span className="ligne-texte">
                          {p.nom}
                          {date && <small className="ticket-date">{date}</small>}
                        </span>
                        <button type="button" className="puce petite" onClick={() => changerLieu(i)} aria-label={`${p.nom} : ${LIEUX[p.lieu]}, toucher pour changer`}>
                          {LIEUX[p.lieu]}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            {ticket.courses.length > 0 && (
              <>
                <p className="discret">À cocher sur la liste de courses :</p>
                <div className="puces ticket-courses" role="group" aria-label="Courses à cocher">
                  {ticket.courses.map((c, i) => (
                    <button type="button" key={c.texte} className={`puce${c.garder ? " active" : ""}`} aria-pressed={c.garder} onClick={() => basculerCourse(i)}>
                      {c.garder ? "✓ " : ""}{c.texte}
                    </button>
                  ))}
                </div>
              </>
            )}
            {total && (
              <section className="carte ticket-total">
                <button type="button" className="ligne chef-interrupteur" onClick={() => setCompterTotal(!compterTotal)} aria-pressed={compterTotal}>
                  <span className="ligne-texte">Compter dans la carte courses</span>
                  <span className={`interrupteur${compterTotal ? " actif" : ""}`} aria-hidden />
                </button>
                {compterTotal && (
                  <div className="formulaire">
                    <label>
                      Total payé
                      <ChampMontant valeur={total.montant} changer={(montant) => changerTotal({ montant })} libelle="Total payé" />
                    </label>
                    <label>
                      Magasin
                      <input defaultValue={total.magasin ?? ""} placeholder="Migros, Coop…" onBlur={(e) => changerTotal({ magasin: e.target.value.trim() || null })} />
                    </label>
                    <label>
                      Le jour
                      <input type="date" value={total.jour} max={donnees.aujourdhui} onChange={(e) => e.target.value && changerTotal({ jour: e.target.value })} />
                    </label>
                    <p className="discret">
                      {paye
                        ? `Déjà payé par Apple Pay ${decrireJour(paye.jour, donnees.aujourdhui).toLowerCase()} (${paye.magasin ?? paye.libelle}, ${formaterMontant(paye.montant)}) : le ticket complète ce paiement avec ses lignes, sans compter deux fois.`
                        : `${decrireJour(total.jour, donnees.aujourdhui)}, ${total.articles.length ? `${total.articles.length} lignes avec leur prix` : "sans le détail des lignes"}.`}
                    </p>
                  </div>
                )}
              </section>
            )}
            <button type="button" className="bouton-principal" disabled={nombre === 0 && !(total && compterTotal) && !ticket.courses.some((c) => c.garder)} onClick={() => void ranger()}>
              {nombre ? `Tout ranger (${nombre})` : total && compterTotal ? "Compter le total" : "Cocher les courses"}
            </button>
          </>
        )}
      </Feuille>
    </>
  );
}
