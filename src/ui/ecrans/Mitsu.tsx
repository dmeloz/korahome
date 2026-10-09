import { useState, type FormEvent, type ReactNode } from "react";
import { ErreurValidation } from "../../domaine/foyer";
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
import { aujourdhuiLocal, contexteReel } from "../contexte";

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
      setErreur(err instanceof ErreurValidation ? err.message : "Impossible d'enregistrer, réessaie.");
    }
  }

  return (
    <main>
      <h1>Mitsu</h1>
      <p className="discret">Sa ration suit son âge et son poids, ses provisions annoncent le jour où commander, et son carnet de santé donne les rappels.</p>
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
    </main>
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
  const [ouvert, setOuvert] = useState<"pesee" | "provision" | "soin" | "fiche" | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Champs des petits formulaires.
  const [poids, setPoids] = useState("");
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

  async function enregistrer(apres: Animal, suite?: () => void) {
    try {
      await depot.enregistrerAnimal(apres);
      setErreur(null);
      suite?.();
    } catch (err) {
      setErreur(err instanceof ErreurValidation ? err.message : "Impossible d'enregistrer, réessaie.");
    }
  }

  function tenter(fabrique: () => Animal, suite?: () => void) {
    try {
      void enregistrer(fabrique(), suite);
    } catch (err) {
      setErreur(err instanceof ErreurValidation ? err.message : "Impossible d'enregistrer, réessaie.");
    }
  }

  const basculer = (quoi: typeof ouvert) => {
    setOuvert(ouvert === quoi ? null : quoi);
    setErreur(null);
  };

  function peser(e: FormEvent) {
    e.preventDefault();
    tenter(() => ajouterPesee(animal, kgEnGrammes(poids), aujourdhui, props.membreId, contexteReel), () => {
      setPoids("");
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

  const precedente = pesee[1];
  const ecartPoids = pesee[0] && precedente ? pesee[0].grammes - precedente.grammes : null;

  return (
    <main>
      <p className="surtitre">{decrireAge(animal.naissance, aujourdhui)}{pesee[0] ? ` · ${formaterPoids(pesee[0].grammes)}` : ""}{animal.sterilise ? " · stérilisée" : ""}</p>
      <h1>{animal.nom}</h1>

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
          <p className="discret">Passage aux croquettes adulte vers le {dateCourte(passageAdulte(animal.naissance))}.</p>
        </div>
      </Section>

      <Section
        titre="Poids"
        action={<button className="lien" onClick={() => basculer("pesee")}>{ouvert === "pesee" ? "Fermer" : "Peser"}</button>}
      >
        {ouvert === "pesee" && (
          <form onSubmit={peser} className="ajout">
            <input inputMode="decimal" value={poids} onChange={(e) => setPoids(e.target.value)} placeholder="Poids en kg, ex. 2,45" aria-label="Poids en kilos" autoFocus />
            <button type="submit" disabled={!poids.trim()} aria-label="Enregistrer le poids">+</button>
          </form>
        )}
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
            <p className="discret">Aucune pesée pour l'instant.</p>
          )}
        </div>
      </Section>

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
        action={<button className="lien" onClick={() => basculer("provision")}>{ouvert === "provision" ? "Fermer" : "Ajouter"}</button>}
      >
        {ouvert === "provision" && (
          <form onSubmit={ajouterUneProvision} className="carte formulaire mitsu-formulaire">
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
        )}
        {animal.provisions.length === 0 ? (
          <p className="carte discret">Ajoute le sac de croquettes et la litière en cours : l'app te dira quand commander.</p>
        ) : (
          <ul className="carte groupe">
            {animal.provisions.map((p) => {
              const prev = prevoir(p, animal, aujourdhui);
              const suivie = articleDe(p, animal) !== undefined;
              const alerte = suivie ? vides.some((v) => v.provision.id === p.id) : !!prev && prev.etat !== "ok";
              return (
                <li key={p.id} className="mitsu-provision">
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
                    <button className="lien" onClick={() => enregistrer(retirerProvision(animal, p.id))}>Paquet fini</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section
        titre="Santé et entretien"
        action={<button className="lien" onClick={() => basculer("soin")}>{ouvert === "soin" ? "Fermer" : "Ajouter"}</button>}
      >
        {ouvert === "soin" && (
          <form onSubmit={ajouterUnSoin} className="carte formulaire mitsu-formulaire">
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
        )}
        {animal.soins.length === 0 ? (
          <p className="carte discret">Recopie les prochaines dates de son carnet (vaccins, vermifuge, antipuces). Quand un soin est fait, l'app prévoit le suivant.</p>
        ) : (
          <ul className="carte groupe">
            {soinsAVenir(animal).map((s) => (
              <li key={s.id} className="mitsu-provision">
                <div className="ligne-texte">
                  <strong>{s.libelle}</strong>
                  <span className={`tache-details${s.date < aujourdhui ? " retard" : ""}`}>
                    {dateCourte(s.date)} · {decrireEcheance(s.date, aujourdhui)}
                  </span>
                </div>
                <div className="tache-actions mitsu-actions">
                  <button className="lien" onClick={() => enregistrer(marquerSoinFait(animal, s.id, aujourdhui, contexteReel))}>Fait aujourd'hui</button>
                  <button className="lien danger" onClick={() => enregistrer(retirerSoin(animal, s.id))}>Retirer</button>
                </div>
              </li>
            ))}
            {soinsFaits(animal).slice(0, 5).map((s) => (
              <li key={s.id} className="ligne">
                <span className="ligne-texte discret">{s.libelle} · fait le {dateCourte(s.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        titre="Sa fiche"
        action={<button className="lien" onClick={() => basculer("fiche")}>{ouvert === "fiche" ? "Fermer" : "Modifier"}</button>}
      >
        <div className="carte">
          <p className="discret">
            Née le {dateCourte(animal.naissance)}
            {animal.arrivee ? `, arrivée le ${dateCourte(animal.arrivee)}` : ""}. Commande {animal.reglages.delaiCommande} jours avant la fin d'une provision.
          </p>
          {ouvert === "fiche" && (
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
              <button type="button" className="ligne mitsu-interrupteur" onClick={() => enregistrer({ ...animal, sterilise: !animal.sterilise })} aria-pressed={animal.sterilise}>
                <span className="ligne-texte">Stérilisée</span>
                <span className={`interrupteur${animal.sterilise ? " actif" : ""}`} aria-hidden />
              </button>
            </div>
          )}
        </div>
      </Section>

      {(erreur || message) && (
        <div className="toast" role={erreur ? "alert" : "status"}>
          <span>{erreur ?? message}</span>
          <button className="lien" onClick={() => { setErreur(null); setMessage(null); }}>OK</button>
        </div>
      )}
    </main>
  );
}
