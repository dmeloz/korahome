import { useState, type FormEvent, type ReactNode } from "react";
import { expliquerErreur } from "../../domaine/erreurs";
import { Feuille } from "../Feuille";
import { nouvelElement } from "../../domaine/listes";
import {
  TYPES_PROVISION,
  aAjouterALaCommande,
  prochaineOccurrence,
  articleDe,
  conseilCommande,
  definirCommande,
  formaterQuantite,
  passerCommande,
  paquetFini,
  type ArticleCommande,
  TYPES_SOIN,
  ajouterPesee,
  ajouterProvision,
  ajouterSoin,
  choseAFaire,
  decrireAge,
  formaterPoids,
  historiquePesees,
  marquerSoinFait,
  nouvelAnimal,
  nouveauSoin,
  nouvelleProvision,
  passageAdulte,
  prevoir,
  prochainePesee,
  rationDuJour,
  retirerProvision,
  retirerSoin,
  soinsAVenir,
  soinsFaits,
  texteCourses,
  videsAvantLivraison,
  type Animal,
  type Provision,
  type TypeProvision,
  type TypeSoin,
} from "../../domaine/mitsu";
import { decrireEcheance } from "../../domaine/taches";
import type { Element, Foyer, Liste } from "../../domaine/types";
import type { Depot } from "../../donnees/depot";
import { useAnnoncer } from "../annulation";
import { aujourdhuiLocal, contexteReel } from "../contexte";
import { Glissable } from "../Glissable";
import { Ligne, ListeVivante, Message } from "../moteur/pieces";
import { CarnetPropose, CourbePoids, Fiches, Infos, Journal } from "./MitsuSuivi";
import { Onglets, Page, useGestionnaireBarre } from "../pieces";
import { Icone } from "../Icone";
import { lirePesee } from "../../domaine/barre";
import { nomFee } from "../fee";

type OngletMitsu = "jour" | "sante" | "provisions";

const dateCourte = (jour: string) =>
  new Date(`${jour}T12:00:00`).toLocaleDateString("fr-CH", { day: "numeric", month: "long" });

/** « 2,45 » ou « 2.45 » → 2450 g ; NaN si illisible. */
const kgEnGrammes = (texte: string) => Math.round(Number(texte.replace(",", ".").trim()) * 1000);

// La dernière commande zooplus de Melo et Sarah (facture du 31 juillet 2026, livrée le 2 août),
// proposée en un geste pour démarrer le suivi sans rien recopier.
const COMMANDE_ZOOPLUS = {
  fournisseur: "zooplus",
  tousLesMois: 3,
  prochaine: "2026-10-27",
  livree: "2026-08-02",
  articles: [
    { type: "croquettes", nom: "Pro Plan Kitten Healthy Start (poulet)", quantite: 6000 },
    { type: "litiere", nom: "Tigerino Crystals Sensitive", quantite: 15000 },
  ] satisfies ArticleCommande[],
  // 6 filtres Catit PIXI, un par mois : pas à chaque commande, l'app dit quand les reprendre.
  filtres: { type: "filtres", nom: "Filtres Catit PIXI", quantite: 6 } satisfies ArticleCommande,
};

interface Props {
  depot: Depot;
  foyer: Foyer;
  membreId: string | null;
  animaux: Animal[];
  listes: Liste[];
  elements: Element[];
}

export function Mitsu(props: Props) {
  const animal = props.animaux[0];
  return animal ? <Suivi {...props} animal={animal} /> : <Premiere depot={props.depot} />;
}

/** Première ouverture : on crée sa fiche avec ce que Melo a déjà donné. */
function Premiere({ depot }: { depot: Depot }) {
  const [nom, setNom] = useState("Mitsu");
  const [naissance, setNaissance] = useState("2026-04-14");
  const [arrivee, setArrivee] = useState("2026-06-21");
  const [erreur, setErreur] = useState<string | null>(null);

  async function creer(e: FormEvent) {
    e.preventDefault();
    try {
      await depot.enregistrerAnimal(nouvelAnimal(nom, naissance, arrivee || null, contexteReel));
    } catch (err) {
      setErreur(expliquerErreur(err, "Enregistrer"));
    }
  }

  return (
    <Page titre="Mitsu" sousTitre="Sa ration suit son âge et son poids, ses provisions annoncent le jour où commander, et son carnet de santé donne les rappels.">
      <form onSubmit={creer} className="carte formulaire">
        <label>
          Son nom
          <input value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="off" />
        </label>
        <label>
          Née le
          <input type="date" value={naissance} onChange={(e) => setNaissance(e.target.value)} />
        </label>
        <label>
          Arrivée chez vous le
          <input type="date" value={arrivee} onChange={(e) => setArrivee(e.target.value)} />
        </label>
        {erreur && <p className="erreur" role="alert">{erreur}</p>}
        <button type="submit" className="bouton-principal">Créer sa fiche</button>
      </form>
    </Page>
  );
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

function Suivi(props: Props & { animal: Animal }) {
  const { animal, depot } = props;
  const aujourdhui = aujourdhuiLocal();
  const [onglet, setOnglet] = useState<OngletMitsu>("jour");
  const [ouvert, setOuvert] = useState<"pesee" | "provision" | "soin" | "fiche" | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Champs des petits formulaires.
  const [poids, setPoids] = useState("");
  const [jourPesee, setJourPesee] = useState(aujourdhui);
  const [typeProvision, setTypeProvision] = useState<TypeProvision>("croquettes");
  const [nomProvision, setNomProvision] = useState("");
  const [quantite, setQuantite] = useState("");
  const [achete, setAchete] = useState(aujourdhui);
  const [parJour, setParJour] = useState("");
  const [typeSoin, setTypeSoin] = useState<TypeSoin>("vaccin");
  const [dateSoin, setDateSoin] = useState(aujourdhui);
  const [libelleSoin, setLibelleSoin] = useState("");
  const [rationPaquet, setRationPaquet] = useState(animal.reglages.rationDuPaquet?.toString() ?? "");

  const ration = rationDuJour(animal, aujourdhui);
  const pesee = historiquePesees(animal);
  const aFaire = choseAFaire(animal, aujourdhui);
  const courses = props.listes.find((l) => l.type === "courses");

  const annoncer = useAnnoncer();
  /** Retire d'un glissement, avec « Annuler » qui remet la fiche telle qu'elle était. */
  const retirer = (apres: Animal, texte: string) => {
    const avant = animal;
    void enregistrer(apres, () => annoncer(texte, () => enregistrer(avant)));
  };

  async function enregistrer(apres: Animal, suite?: () => void) {
    try {
      await depot.enregistrerAnimal(apres);
      setErreur(null);
      suite?.();
    } catch (err) {
      setErreur(expliquerErreur(err, "Enregistrer"));
    }
  }

  /** Enregistre ; avec un texte, l'annonce avec « Annuler » qui remet la fiche d'avant. */
  function modifier(fabrique: () => Animal, annonce?: string) {
    const avant = animal;
    tenter(fabrique, annonce ? () => annoncer(annonce, () => enregistrer(avant)) : undefined);
  }

  function tenter(fabrique: () => Animal, suite?: () => void) {
    try {
      void enregistrer(fabrique(), suite);
    } catch (err) {
      setErreur(expliquerErreur(err, "Enregistrer"));
    }
  }

  const basculer = (quoi: typeof ouvert) => {
    setOuvert(ouvert === quoi ? null : quoi);
    setErreur(null);
  };
  const fermer = () => setOuvert(null);

  function peser(e: FormEvent) {
    e.preventDefault();
    tenter(() => ajouterPesee(animal, kgEnGrammes(poids), jourPesee, props.membreId, contexteReel), () => {
      setPoids("");
      setJourPesee(aujourdhui);
      setOuvert(null);
    });
  }

  function ajouterUneProvision(e: FormEvent) {
    e.preventDefault();
    const consommation = parJour.trim() ? Number(parJour.replace(",", ".")) : null;
    tenter(
      () =>
        ajouterProvision(
          animal,
          nouvelleProvision({ type: typeProvision, nom: nomProvision, quantite: typeProvision === "filtres" ? Number(quantite.replace(",", ".")) : kgEnGrammes(quantite), achete, parJour: consommation }, contexteReel),
        ),
      () => {
        setNomProvision("");
        setQuantite("");
        setParJour("");
        setOuvert(null);
      },
    );
  }

  function ajouterUnSoin(e: FormEvent) {
    e.preventDefault();
    tenter(() => ajouterSoin(animal, nouveauSoin(typeSoin, dateSoin, libelleSoin, contexteReel)), () => {
      setLibelleSoin("");
      setOuvert(null);
    });
  }

  async function versCourses(p: Provision) {
    if (!courses) return;
    const texte = texteCourses(p, animal);
    const deja = props.elements.some((e) => e.listeId === courses.id && !e.coche && e.texte === texte);
    if (!deja) await depot.enregistrerElement({ ...nouvelElement(courses, texte, props.membreId, contexteReel), rayon: "Animaux" });
    setMessage(deja ? "Déjà dans la liste de courses." : `« ${texte} » ajouté aux courses.`);
  }

  /** Le paquet est fini : Kora apprend ce qu'elle en a vraiment mangé par jour, et le dit quand c'est loin de ce qu'il prévoyait. */
  function paquetTermine(p: Provision) {
    const { animal: apres, observee, prevue } = paquetFini(animal, p.id, aujourdhui);
    const ecart = observee && prevue ? (observee.parJour - prevue) / prevue : 0;
    const unite = p.type === "litiere" ? "ml" : "g";
    void enregistrer(apres, () => {
      if (observee && Math.abs(ecart) >= 0.1) {
        setMessage(`${animal.nom} en a pris ${observee.parJour} ${unite} par jour, ${ecart > 0 ? "plus" : "moins"} que les ${Math.round(prevue!)} ${unite} prévus. Kora s'en sert désormais pour prévoir la suite.`);
      } else if (observee) {
        setMessage(`Noté : ${observee.parJour} ${unite} par jour, comme prévu.`);
      }
    });
  }

  function enregistrerRation(e: FormEvent) {
    e.preventDefault();
    const g = Number(rationPaquet.replace(",", "."));
    const valeur = rationPaquet.trim() && g > 0 ? Math.round(g) : null;
    void enregistrer({ ...animal, reglages: { ...animal.reglages, rationDuPaquet: valeur } });
  }

  const commande = animal.commande;
  const vides = videsAvantLivraison(animal, aujourdhui);
  const conseil = conseilCommande(animal);
  const aAjouter = aAjouterALaCommande(animal, aujourdhui);

  function reprendreCommande() {
    const { livree, filtres, ...champs } = COMMANDE_ZOOPLUS;
    tenter(() => {
      let a = definirCommande(animal, { ...champs, articles: [...champs.articles] });
      for (const art of [...champs.articles, filtres]) {
        if (a.provisions.some((p) => p.type === art.type && p.nom === art.nom)) continue;
        a = ajouterProvision(a, nouvelleProvision({ ...art, achete: livree, parJour: null }, contexteReel));
      }
      // Un filtre neuf chaque mois, au même jour que la livraison.
      if (!a.soins.some((x) => x.type === "filtre" && !x.fait)) {
        a = ajouterSoin(a, nouveauSoin("filtre", prochaineOccurrence(livree, 1, aujourdhui), "", contexteReel));
      }
      return a;
    });
  }

  // Dans la barre, un poids (« 2,45 kg ») devient une pesée du jour ; le reste va à Jarvis.
  useGestionnaireBarre("module:mitsu", async (texte) => {
    const grammes = lirePesee(texte);
    if (grammes === null) return false;
    modifier(() => ajouterPesee(animal, grammes, aujourdhui, props.membreId, contexteReel), `Pesée notée : ${formaterPoids(grammes)}.`);
    return true;
  });

  const precedente = pesee[1];
  const ecartPoids = pesee[0] && precedente ? pesee[0].grammes - precedente.grammes : null;

  return (
    <Page
      titre={animal.nom}
      sousTitre={`${decrireAge(animal.naissance, aujourdhui)}${pesee[0] ? ` · ${formaterPoids(pesee[0].grammes)}` : ""}${animal.sterilise ? (animal.sexe === "male" ? " · castré" : " · stérilisée") : ""}`}
      aide={{ cle: "mitsu", texte: `Trois onglets : la journée (repas, litière, poids), sa santé (vaccins, vermifuge, fiche) et ses provisions (commande zooplus, croquettes, litière). Dis son poids à ta fée (« 2,45 kg ») pour noter une pesée ; le reste, demande-le à ${nomFee()}.` }}
      className="mitsu"
    >
      <Onglets
        libelle={`Suivi de ${animal.nom}`}
        onglets={[
          { id: "jour", libelle: "Aujourd'hui", compte: aFaire.length },
          { id: "sante", libelle: "Santé", compte: soinsAVenir(animal).filter((x) => x.date <= aujourdhui).length },
          { id: "provisions", libelle: "Provisions", compte: vides.length + aAjouter.length },
        ]}
        actif={onglet}
        changer={setOnglet}
      />

      {onglet === "jour" && (
      <>

      {aFaire.length > 0 && (
        <Section titre="À faire">
          <ul className="carte groupe">
            {aFaire.map((c) => (
              <li key={c.texte} className="ligne">
                <span className={`ligne-texte${c.urgent ? " urgent-texte" : ""}`}>{c.texte}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section titre="Journal">
        <Journal animal={animal} aujourdhui={aujourdhui} modifier={modifier} membres={props.foyer.membres} membreId={props.membreId} />
      </Section>

      <Section titre="Ration du jour">
        <div className="carte mitsu-ration">
          {ration ? (
            <>
              <p className="mitsu-chiffre"><strong>{ration.grammes} g</strong> de croquettes par jour</p>
              <p className="discret">
                {ration.source === "paquet"
                  ? "La ration notée depuis le paquet."
                  : `Estimation selon son âge et son poids (${ration.kcal} kcal). Le tableau du paquet est plus juste : note-le ci-dessous.`}
              </p>
            </>
          ) : (
            <p className="discret">Pèse-la une première fois pour que l'app calcule sa ration.</p>
          )}
          <form onSubmit={enregistrerRation} className="ajout">
            <input
              inputMode="decimal"
              value={rationPaquet}
              onChange={(e) => setRationPaquet(e.target.value)}
              placeholder="Ration du paquet, en g"
              aria-label="Ration du paquet en grammes par jour"
            />
            <button type="submit" aria-label="Enregistrer la ration">✓</button>
          </form>
          <div>
            <p className="discret">
              Friandises par jour{ration ? ` (au plus ${ration.friandisesMax} g)` : ""} : elles sont retirées des croquettes.
            </p>
            <div className="puces" role="group" aria-label="Friandises par jour">
              {[0, 2, 4, 6, 8].map((g) => {
                const actif = (animal.reglages.friandisesParJour ?? 0) === g;
                return (
                  <button type="button" key={g} className={`puce${actif ? " active" : ""}`} aria-pressed={actif} onClick={() => enregistrer({ ...animal, reglages: { ...animal.reglages, friandisesParJour: g || undefined } })}>
                    {g ? `${g} g` : "Aucune"}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="discret">Passage aux croquettes adulte vers le {dateCourte(passageAdulte(animal.naissance))}.</p>
        </div>
      </Section>

      <Section
        titre="Poids"
        action={<button className="lien" onClick={() => basculer("pesee")}>Peser</button>}
      >
        <Feuille ouverte={ouvert === "pesee"} onFermer={fermer} titre={`Peser ${animal.nom}`} fermer="Annuler">
          <form onSubmit={peser} className="ajout">
            <input inputMode="decimal" value={poids} onChange={(e) => setPoids(e.target.value)} placeholder="Poids en kg, ex. 2,45" aria-label="Poids en kilos" />
            <label className="puce puce-date">
              {jourPesee === aujourdhui ? "Aujourd'hui" : dateCourte(jourPesee)}
              <input type="date" value={jourPesee} max={aujourdhui} onChange={(e) => setJourPesee(e.target.value || aujourdhui)} aria-label="Jour de la pesée" />
            </label>
            <button type="submit" disabled={!poids.trim()} aria-label="Enregistrer le poids"><Icone nom="coche" taille={18} /></button>
          </form>
        </Feuille>
        <div className="carte">
          {pesee[0] ? (
            <>
              <p>
                <strong>{formaterPoids(pesee[0].grammes)}</strong>
                <span className="discret"> le {dateCourte(pesee[0].jour)}{ecartPoids !== null ? ` · ${ecartPoids >= 0 ? "+" : "−"}${Math.abs(ecartPoids)} g` : ""}</span>
              </p>
              <p className="discret">Prochaine pesée vers le {dateCourte(prochainePesee(animal, aujourdhui))}, ou à la prochaine visite chez le vétérinaire.</p>
              {pesee.length > 1 && (
                <p className="discret mitsu-historique">
                  {pesee.slice(1, 6).map((p) => `${dateCourte(p.jour)} : ${formaterPoids(p.grammes)}`).join(" · ")}
                </p>
              )}
            </>
          ) : (
            <p className="discret">Aucune pesée pour l'instant. Une pesée du vétérinaire compte aussi : choisis son jour en la notant.</p>
          )}
          <CourbePoids animal={animal} aujourdhui={aujourdhui} />
        </div>
      </Section>

      </>
      )}

      {onglet === "provisions" && (
      <>
      <Section titre="Commande régulière">
        {commande ? (
          <div className="carte mitsu-commande">
            <p>
              <strong>{commande.fournisseur}</strong>
              <span className="discret"> · tous les {commande.tousLesMois} mois</span>
            </p>
            <p>
              Prochaine commande le <strong>{dateCourte(commande.prochaine)}</strong>
              <span className="discret"> ({decrireEcheance(commande.prochaine, aujourdhui)})</span>
            </p>
            <ul className="mitsu-articles">
              {commande.articles.map((a) => (
                <li key={a.nom} className="discret">{a.nom} · {formaterQuantite(a.type, a.quantite)}</li>
              ))}
            </ul>
            {vides.map(({ provision, fin }) => (
              <p key={provision.id} className="urgent-texte">
                {provision.nom} sera vide vers le {dateCourte(fin)}, avant l'arrivée de la commande : commande plus tôt.
              </p>
            ))}
            {aAjouter.map(({ provision, fin }) => (
              <p key={provision.id} className="mitsu-conseil">
                À ajouter à cette commande : {provision.nom} (vides vers le {dateCourte(fin)}).
              </p>
            ))}
            {conseil && <p className="mitsu-conseil">{conseil}</p>}
            <label className="date-tache">
              Changer la date
              <input type="date" value={commande.prochaine} onChange={(e) => e.target.value && enregistrer({ ...animal, commande: { ...commande, prochaine: e.target.value } })} />
            </label>
            <button className="bouton-principal" onClick={() => enregistrer(passerCommande(animal, aujourdhui, contexteReel, aAjouter.map((x) => x.provision.id)), () => setMessage("Stock mis à jour. Prochaine commande dans " + commande.tousLesMois + " mois."))}>
              Commande passée aujourd'hui
            </button>
          </div>
        ) : (
          <div className="carte mitsu-commande">
            <p className="discret">Vous commandez chez zooplus tous les 3 mois. Reprends la dernière commande (croquettes Pro Plan Kitten 6 kg, litière Tigerino 15 L et 6 filtres de fontaine) : l'app suit le stock, te rappelle la prochaine commande, le 27 octobre, et le filtre à changer chaque mois.</p>
            <button className="bouton-principal" onClick={reprendreCommande}>Reprendre la commande zooplus</button>
          </div>
        )}
      </Section>

      <Section
        titre="Provisions"
        action={<button className="lien" onClick={() => basculer("provision")}>Ajouter</button>}
      >
        <Feuille ouverte={ouvert === "provision"} onFermer={fermer} titre="Nouvelle provision" fermer="Annuler">
          <form onSubmit={ajouterUneProvision} className="formulaire mitsu-formulaire">
            <div className="puces" role="group" aria-label="Type">
              {(Object.keys(TYPES_PROVISION) as TypeProvision[]).map((t) => (
                <button type="button" key={t} className={`puce${t === typeProvision ? " active" : ""}`} aria-pressed={t === typeProvision} onClick={() => setTypeProvision(t)}>
                  {TYPES_PROVISION[t]}
                </button>
              ))}
            </div>
            <label>
              Produit
              <input value={nomProvision} onChange={(e) => setNomProvision(e.target.value)} placeholder="Comme sur la facture" autoComplete="off" />
            </label>
            <label>
              {typeProvision === "filtres" ? "Nombre de filtres" : `Quantité achetée (${typeProvision === "litiere" ? "litres" : "kg"})`}
              <input inputMode="decimal" value={quantite} onChange={(e) => setQuantite(e.target.value)} placeholder={typeProvision === "filtres" ? "ex. 6" : "ex. 2"} />
            </label>
            <label>
              Acheté ou ouvert le
              <input type="date" value={achete} onChange={(e) => setAchete(e.target.value || aujourdhui)} />
            </label>
            <label>
              {typeProvision === "filtres" ? "Un filtre par mois (laisse vide)" : `Consommation par jour (${typeProvision === "litiere" ? "ml" : "g"})`}
              <input
                inputMode="decimal"
                value={parJour}
                onChange={(e) => setParJour(e.target.value)}
                placeholder={typeProvision === "croquettes" ? "Vide : la ration du jour" : typeProvision === "filtres" ? "" : "ex. 150"}
              />
            </label>
            <button type="submit" className="bouton-principal" disabled={!quantite.trim()}>Ajouter</button>
          </form>
        </Feuille>
        {animal.provisions.length === 0 ? (
          <p className="carte discret">Ajoute le sac de croquettes et la litière en cours : l'app te dira quand commander.</p>
        ) : (
          <ListeVivante className="carte groupe">
            {animal.provisions.map((p) => {
              const prev = prevoir(p, animal, aujourdhui);
              const suivie = articleDe(p, animal) !== undefined;
              const alerte = suivie ? vides.some((v) => v.provision.id === p.id) : !!prev && prev.etat !== "ok";
              return (
                <Ligne key={p.id}>
                  <Glissable className="mitsu-provision" libelle="Retirer" onSupprimer={() => retirer(retirerProvision(animal, p.id), `« ${p.nom} » retiré.`)}>
                  <div className="ligne-texte">
                    <strong>{p.nom}</strong>
                    <span className={`tache-details${alerte ? " retard" : ""}`}>
                      {TYPES_PROVISION[p.type]} · {prev ? `reste environ ${formaterQuantite(p.type, prev.restant)}` : formaterQuantite(p.type, p.quantite)}
                      {!prev
                        ? " · note la consommation par jour pour prévoir la fin"
                        : prev.etat === "epuise"
                          ? " · fini"
                          : ` · jusqu'au ${dateCourte(prev.fin)} · ${
                              (suivie || aAjouter.some((x) => x.provision.id === p.id)) && commande
                                ? `${suivie ? "réassort avec" : "à ajouter à"} la commande du ${dateCourte(commande.prochaine)}`
                                : prev.etat === "commander"
                                  ? "à commander maintenant"
                                  : `commander le ${dateCourte(prev.commanderLe)}`
                            }`}
                    </span>
                  </div>
                  <div className="tache-actions mitsu-actions">
                    {alerte && courses && (
                      <button className="lien" onClick={() => versCourses(p)}>Ajouter aux courses</button>
                    )}
                    <button className="lien" onClick={() => paquetTermine(p)}>Paquet fini</button>
                  </div>
                  </Glissable>
                </Ligne>
              );
            })}
          </ListeVivante>
        )}
      </Section>

      </>
      )}

      {onglet === "sante" && (
      <>
      <Section
        titre="À venir"
        action={<button className="lien" onClick={() => basculer("soin")}>Ajouter</button>}
      >
        <Feuille ouverte={ouvert === "soin"} onFermer={fermer} titre="Ajouter au carnet" fermer="Annuler">
          <form onSubmit={ajouterUnSoin} className="formulaire mitsu-formulaire">
            <div className="puces" role="group" aria-label="Soin">
              {(Object.keys(TYPES_SOIN) as TypeSoin[]).map((t) => (
                <button type="button" key={t} className={`puce${t === typeSoin ? " active" : ""}`} aria-pressed={t === typeSoin} onClick={() => setTypeSoin(t)}>
                  {TYPES_SOIN[t]}
                </button>
              ))}
            </div>
            <label>
              Prévu le
              <input type="date" value={dateSoin} onChange={(e) => setDateSoin(e.target.value || aujourdhui)} />
            </label>
            <label>
              Précision
              <input value={libelleSoin} onChange={(e) => setLibelleSoin(e.target.value)} placeholder={TYPES_SOIN[typeSoin]} autoComplete="off" />
            </label>
            <button type="submit" className="bouton-principal">Ajouter au carnet</button>
          </form>
        </Feuille>
        <CarnetPropose animal={animal} aujourdhui={aujourdhui} modifier={modifier} />
        {soinsAVenir(animal).length > 0 && (
          <ListeVivante className="carte groupe">
            {soinsAVenir(animal).map((s) => (
              <Ligne key={s.id}>
                <Glissable className="mitsu-provision" libelle="Retirer" onSupprimer={() => retirer(retirerSoin(animal, s.id), `« ${s.libelle} » retiré du carnet.`)}>
                <div className="ligne-texte">
                  <strong>{s.libelle}</strong>
                  <span className={`tache-details${s.date < aujourdhui ? " retard" : ""}`}>
                    {dateCourte(s.date)} · {decrireEcheance(s.date, aujourdhui)}
                  </span>
                  {s.details && <span className="tache-details">{s.details}</span>}
                </div>
                <div className="tache-actions mitsu-actions">
                  <button className="lien" onClick={() => enregistrer(marquerSoinFait(animal, s.id, aujourdhui, contexteReel))}>Fait aujourd'hui</button>
                </div>
                </Glissable>
              </Ligne>
            ))}
          </ListeVivante>
        )}
        {soinsFaits(animal).length > 0 && (
          // Ce qui est fait (les vaccins de chaton, les vermifuges passés) se range ici, replié.
          <details className="carte mitsu-classes">
            <summary>
              <span className="ligne-texte">Déjà faits</span>
              <span className="discret">{soinsFaits(animal).length}</span>
            </summary>
            <ul className="groupe">
              {soinsFaits(animal).map((s) => (
                <li key={s.id} className="ligne">
                  <span className="ligne-texte discret">
                    {s.libelle} · fait le {dateCourte(s.date)}
                    {s.details && <><br />{s.details}</>}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Section>

      <Section titre="À partager">
        <Fiches animal={animal} aujourdhui={aujourdhui} membres={props.foyer.membres} informer={setMessage} />
      </Section>

      <Section
        titre="Sa fiche"
        action={<button className="lien" onClick={() => basculer("fiche")}>Modifier</button>}
      >
        <div className="carte">
          {(animal.infos?.nomComplet || animal.infos?.race || animal.infos?.pelage) && (
            <p className="discret">
              {[animal.infos.nomComplet, [animal.infos.race, animal.infos.pelage?.toLowerCase()].filter(Boolean).join(" "), animal.sexe === "male" ? "mâle" : "femelle"].filter(Boolean).join(" · ")}
            </p>
          )}
          <p className="discret">
            Née le {dateCourte(animal.naissance)}
            {animal.arrivee ? `, arrivée le ${dateCourte(animal.arrivee)}` : ""}. Commande {animal.reglages.delaiCommande} jours avant la fin d'une provision.
          </p>
          {(animal.infos?.veterinaire || animal.infos?.puce) && (
            <p className="discret">
              {[animal.infos.veterinaire && `Vétérinaire : ${[animal.infos.veterinaire, animal.infos.adresseVeto, animal.infos.telephoneVeto].filter(Boolean).join(", ")}`, animal.infos.puce && `Puce ${animal.infos.puce}${animal.infos.pucePoseeLe ? ` (posée le ${dateCourte(animal.infos.pucePoseeLe)})` : ""}`].filter(Boolean).join(" · ")}
            </p>
          )}
          <Feuille ouverte={ouvert === "fiche"} onFermer={fermer} titre={`Fiche de ${animal.nom}`}>
            <div className="formulaire mitsu-fiche">
              <label>
                Née le
                <input type="date" value={animal.naissance} onChange={(e) => e.target.value && enregistrer({ ...animal, naissance: e.target.value })} />
              </label>
              <label>
                Arrivée le
                <input type="date" value={animal.arrivee ?? ""} onChange={(e) => enregistrer({ ...animal, arrivee: e.target.value || null })} />
              </label>
              <div>
                <p className="discret">Commander combien de jours avant la fin ?</p>
                <div className="puces" role="group" aria-label="Délai de commande">
                  {[3, 7, 10, 14].map((n) => (
                    <button type="button" key={n} className={`puce${n === animal.reglages.delaiCommande ? " active" : ""}`} aria-pressed={n === animal.reglages.delaiCommande} onClick={() => enregistrer({ ...animal, reglages: { ...animal.reglages, delaiCommande: n } })}>
                      {n} jours
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="discret">La peser tous les</p>
                <div className="puces" role="group" aria-label="Rythme des pesées">
                  {[[30, "mois"], [90, "3 mois"], [180, "6 mois"]].map(([n, libelle]) => (
                    <button type="button" key={n} className={`puce${n === animal.reglages.peseeTousLes ? " active" : ""}`} aria-pressed={n === animal.reglages.peseeTousLes} onClick={() => enregistrer({ ...animal, reglages: { ...animal.reglages, peseeTousLes: Number(n) } })}>
                      {libelle}
                    </button>
                  ))}
                </div>
              </div>
              <div className="puces" role="group" aria-label="Sexe">
                {(["femelle", "male"] as const).map((x) => {
                  const actif = (animal.sexe ?? "femelle") === x;
                  return (
                    <button type="button" key={x} className={`puce${actif ? " active" : ""}`} aria-pressed={actif} onClick={() => enregistrer({ ...animal, sexe: x })}>
                      {x === "femelle" ? "Femelle" : "Mâle"}
                    </button>
                  );
                })}
              </div>
              <button type="button" className="ligne mitsu-interrupteur" onClick={() => enregistrer({ ...animal, sterilise: !animal.sterilise })} aria-pressed={animal.sterilise}>
                <span className="ligne-texte">{animal.sexe === "male" ? "Castré" : "Stérilisée"}</span>
                <span className={`interrupteur${animal.sterilise ? " actif" : ""}`} aria-hidden />
              </button>
              <Infos animal={animal} modifier={modifier} />
            </div>
          </Feuille>
        </div>
      </Section>
      </>
      )}

      <Message visible={!!(erreur || message)} cle={erreur ?? message ?? undefined} role={erreur ? "alert" : "status"}>
        <span>{erreur ?? message}</span>
        <button className="lien" onClick={() => { setErreur(null); setMessage(null); }}>OK</button>
      </Message>
    </Page>
  );
}
