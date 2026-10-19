import { useRef, useState } from "react";
import { apprendre, type ProduitHabituel } from "../domaine/catalogue";
import { formaterMontant, planDe } from "../domaine/budget";
import { appliquerActions, decrireFoyer, lireActions, type ActionJarvis, type DonneesFoyer } from "../domaine/jarvis";
import { LIEUX, ORDRE_LIEUX, type Lieu } from "../domaine/stock";
import type { Depot } from "../donnees/depot";
import type { ServeurJarvis } from "../donnees/distant";
import { useAnnoncer } from "./annulation";
import { contexteReel } from "./contexte";
import { Feuille } from "./Feuille";
import { vibrer } from "./haptique";
import { Icone } from "./Icone";
import { annulerModifications, enregistrerModifications, photoPourJarvis } from "./jarvis";
import { nomFee } from "./fee";

// Le ticket de caisse en entier, depuis Frigo et placards : une photo, Jarvis lit chaque
// ligne, on vérifie la liste (décocher, changer le lieu), puis tout se range d'un coup,
// la Base apprend chaque produit et les courses correspondantes se cochent. Le total
// du ticket compte dans la carte courses du Budget.

const DEMANDE =
  "Voici un ticket de caisse. Range au stock tous les produits alimentaires et d'hygiène achetés (ajouter_au_stock), un par ligne du ticket, avec leur quantité dans le nom et le lieu où on les range d'habitude. Coche aussi les courses correspondantes (cocher_courses), et note le total payé au budget (noter_depense, pot courses, avec le magasin, la date du ticket et chaque ligne avec son prix dans articles).";

interface LigneTicket {
  nom: string;
  lieu: Lieu;
  peremption: string | null;
  garder: boolean;
}

export function TicketDeCaisse(props: {
  jarvis: { serveur: ServeurJarvis; foyerId: string } | null;
  donnees: DonneesFoyer & { aujourdhui: string; membreId: string | null };
  depot: Depot;
  catalogue: ProduitHabituel[];
  /** La classe du bouton : dans la barre Jarvis, il en prend l'allure. */
  classe?: string;
}) {
  const { depot, donnees } = props;
  const choix = useRef<HTMLInputElement>(null);
  const annoncer = useAnnoncer();
  const [etat, setEtat] = useState<"ferme" | "lecture" | "verification" | "erreur">("ferme");
  const [lignes, setLignes] = useState<LigneTicket[]>([]);
  const [courses, setCourses] = useState<string[]>([]);
  const [total, setTotal] = useState<Extract<ActionJarvis, { outil: "noter_depense" }> | null>(null);
  const [compterTotal, setCompterTotal] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  if (!props.jarvis) return null;
  const jarvis = props.jarvis;

  async function lire(fichier: File | undefined) {
    if (!fichier) return;
    setEtat("lecture");
    setErreur(null);
    try {
      const image = await photoPourJarvis(fichier);
      const reponse = await jarvis.serveur.demanderJarvis({
        foyerId: jarvis.foyerId,
        demande: DEMANDE,
        etat: decrireFoyer(donnees, donnees.membreId, donnees.aujourdhui),
        historique: [],
        image,
      });
      const actions = lireActions(reponse.appels);
      const produits = actions.flatMap((a) => (a.outil === "ajouter_au_stock" ? a.produits : []));
      const depense = actions.find((a): a is Extract<ActionJarvis, { outil: "noter_depense" }> => a.outil === "noter_depense") ?? null;
      setTotal(depense && planDe(donnees.budget ?? []) ? depense : null);
      setCompterTotal(true);
      if (!produits.length && !depense) {
        setErreur(reponse.texte || "Je n'ai pas trouvé de produits sur cette photo. Essaie avec le ticket bien à plat et éclairé.");
        setEtat("erreur");
        return;
      }
      setLignes(produits.map((p) => ({ ...p, garder: true })));
      setCourses(actions.flatMap((a) => (a.outil === "cocher_courses" ? a.articles : [])));
      setEtat("verification");
    } catch (e) {
      setErreur(e instanceof Error && e.message ? e.message : "Je n'ai pas pu lire le ticket, réessaie.");
      setEtat("erreur");
    }
  }

  async function ranger() {
    const gardees = lignes.filter((l) => l.garder);
    const actions: ActionJarvis[] = gardees.length ? [{ outil: "ajouter_au_stock", produits: gardees.map(({ nom, lieu, peremption }) => ({ nom, lieu, peremption })) }] : [];
    if (courses.length) actions.push({ outil: "cocher_courses", articles: courses });
    if (total && compterTotal) actions.push({ ...total, pot: "courses", charge: null });
    const applique = appliquerActions(actions, donnees, donnees.membreId, donnees.aujourdhui, contexteReel);
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
    const n = gardees.length;
    const compte = total && compterTotal ? ` ${formaterMontant(total.montant)} comptés dans les courses.` : "";
    annoncer(n ? `${n} produit${n > 1 ? "s" : ""} rangé${n > 1 ? "s" : ""} depuis le ticket.${compte}` : compte.trim(), async () => {
      await annulerModifications(depot, resultat.modifications);
      for (let i = appris.length - 1; i >= 0; i--) {
        const avant = avantBase[i];
        await (avant ? depot.enregistrerHabituel(avant) : depot.supprimerHabituel(appris[i].id));
      }
    });
  }

  const basculer = (i: number) => setLignes((ls) => ls.map((l, j) => (j === i ? { ...l, garder: !l.garder } : l)));
  const changerLieu = (i: number) =>
    setLignes((ls) => ls.map((l, j) => (j === i ? { ...l, lieu: ORDRE_LIEUX[(ORDRE_LIEUX.indexOf(l.lieu) + 1) % ORDRE_LIEUX.length] } : l)));
  const nombre = lignes.filter((l) => l.garder).length;

  return (
    <>
      <button type="button" className={props.classe ?? "bouton-scan"} onClick={() => choix.current?.click()} aria-label="Photographier un ticket de caisse" disabled={etat === "lecture"}>
        <Icone nom="ticket" taille={22} />
      </button>
      <input
        ref={choix}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void lire(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Feuille
        ouverte={etat !== "ferme"}
        onFermer={() => setEtat("ferme")}
        titre={etat === "verification" ? "Sur le ticket" : "Ticket de caisse"}
        fermer="Annuler"
      >
        {etat === "lecture" && (
          <div className="ticket-lecture">
            <div className="bulle jarvis attente" aria-label={`${nomFee()} lit le ticket`}><span /><span /><span /></div>
            <p className="discret">{nomFee()} lit chaque ligne du ticket…</p>
          </div>
        )}
        {etat === "erreur" && <p className="discret">{erreur}</p>}
        {etat === "verification" && (
          <>
            <p className="discret">Décoche ce qui ne va pas au stock ; touche le lieu pour le changer.</p>
            <ul className="carte groupe ticket-lignes">
              {lignes.map((l, i) => (
                <li key={i} className={`ligne${l.garder ? "" : " coche"}`}>
                  <button type="button" className="case" onClick={() => basculer(i)} aria-pressed={l.garder} aria-label={`Ranger ${l.nom}`}>
                    {l.garder ? "✓" : ""}
                  </button>
                  <span className="ligne-texte">{l.nom}</span>
                  <button type="button" className="puce petite" onClick={() => changerLieu(i)}>{LIEUX[l.lieu]}</button>
                </li>
              ))}
            </ul>
            {courses.length > 0 && <p className="discret">Coché aussi sur la liste : {courses.join(", ")}.</p>}
            {total && (
              <button type="button" className="ligne chef-interrupteur" onClick={() => setCompterTotal(!compterTotal)} aria-pressed={compterTotal}>
                <span className="ligne-texte">
                  Total {formaterMontant(total.montant)}
                  {total.magasin ? ` chez ${total.magasin}` : ""}, compté dans la carte courses
                </span>
                <span className={`interrupteur${compterTotal ? " actif" : ""}`} aria-hidden />
              </button>
            )}
            <button type="button" className="bouton-principal" disabled={nombre === 0 && !(total && compterTotal)} onClick={() => void ranger()}>
              {nombre ? `Tout ranger (${nombre})` : "Compter le total"}
            </button>
          </>
        )}
      </Feuille>
    </>
  );
}
