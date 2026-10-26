import type { Depot } from "../../donnees/depot";
import type { ServeurJarvis } from "../../donnees/distant";
import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { createPortal } from "react-dom";
import { bilanAOuvrir, bilanDeLaSemaine, remarqueDuJour } from "../../domaine/apprentissage";
import { carteDuJour, resteAFaire, titreMoment, type ChoseDuJour } from "../../domaine/aujourdhui";
import { reglageDechets } from "../../domaine/maison";
import { etatDesPots, facturesDuJour, planDe } from "../../domaine/budget";
import { evenementsDe, ligneWidget, resumeAgenda } from "../../domaine/agenda";
import {
  basculerRetiree,
  CARTES,
  composerPiles,
  decouperLigne,
  enDirect,
  momentAccueil,
  montrerIndice,
  RAISON_DU_MOMENT,
  tuileAgenda,
  type CarteId,
} from "../../domaine/ecranAccueil";
import type { EtatPartage } from "../../domaine/etatPartage";
import { filDuFoyer, quiDe, resumeDuJour } from "../../domaine/fil";
import type { OuRecherche } from "../../domaine/recherche";
import { repartitionDue } from "../../domaine/repartition";
import { decrireDerniere, sauvegardeDue } from "../../domaine/sauvegarde";
import { compterDues, decaler, decrireEcheance, marquerFaite } from "../../domaine/taches";
import { signesDuJour, type Signe, type ValeurSigne } from "../../domaine/signes";
import { clinDuJour } from "../../domaine/bandeau";
import type { Tache } from "../../domaine/types";
import type { WidgetId } from "../../domaine/tableauDeBord";
import { useAnnoncer } from "../annulation";
import { aujourdhuiLocal, contexteReel } from "../contexte";
import { Icone, type NomIcone } from "../Icone";
import { MODULES, type ApercuWidget, type DonneesModule } from "../modules";
import { vibrer } from "../haptique";
import { calculerApprentissages } from "../apprendre";
import { Feuille, Visite } from "../pieces";
import { CarteDemarrage } from "../pieces/Demarrage";
import { CeSoir, ChiffresDuJour, ContenuApercu, PastilleDirect, Pile, type CartePile, type LignePile, type TuileChiffre } from "../pieces/EcranAccueil";
import { FeuilleHeure } from "../pieces/FeuilleHeure";
import { GrandeDate, Signes } from "../pieces/HautAccueil";
import { clinDejaDit, noterClinDit, useClinDuJour } from "../clinDuJour";
import { nouveauteADire } from "../../domaine/nouveautes";
import { CLES, ecrireTexte, lireTexte } from "../stockageLocal";
import { direSiCalme, feteFee, taireFee } from "../fee";
import { feter } from "../moteur/fete";
import { nuitDeCeTelephone, useVieFee } from "../vieFee";
import { enregistrerIndiceGlisse, enregistrerRetirees, lireIndiceGlisse, lireRetirees, lireSignes } from "../accueilLocal";
import { abonnerVisite, finirVisite, visiteEnAttente } from "../visite";
import { RechercheFee } from "../pieces/RechercheFee";
import { lireDerniereSauvegarde } from "../sauvegarde";
import { fermerRemarque, lireAdaptations, lireDernierBilan, noterUsage, remarqueAMontrer, useApprentissageLocal } from "../usage";
import { lireDerniereRepartition } from "./Taches";
import { heureMinute } from "../../domaine/texte";
import { etatRappels } from "../rappels";
import { ignorer } from "../journal";

// L'accueil « tout sur un écran » (Kora 0.0.72) : la date et ses signes, la pastille « en
// direct », quatre chiffres du jour, « Ce soir » qui tourne tout seul et deux piles sous « En ce
// moment ». Ce que montrent les piles suit le moment (domaine/ecranAccueil.ts) ; chaque téléphone
// peut en retirer ou en remettre des cartes (appui long sur une pile). Depuis 0.0.73, l'accueil ne
// défile plus quand tout tient : la loupe près de la date ouvre la recherche et les autres pages.

/** Combien de choses du jour « Ce soir » fait tourner. */
const CHOSES_CARTE = 12;

function salutation(heure: number): string {
  if (heure < 5) return "Bonne nuit";
  if (heure < 18) return "Bonjour";
  return "Bonsoir";
}


const PICTO_CARTE: Record<CarteId, NomIcone> = { maison: "maison", chef: "toque", courses: "panier", agenda: "calendrier", budget: "portefeuille", fil: "activite", bilan: "appris" };

/** « 3 à faire », ou la légende seule quand le chiffre est nul. */
const contexteDe = (a: ApercuWidget) => (a.chiffre > 0 ? `${a.chiffre} ${a.legende}` : a.legende);
const lignesDe = (a: ApercuWidget): LignePile[] => a.lignes.map((l, i) => ({ ...decouperLigne(l), urgent: a.urgent && i === 0 }));

export function Accueil(props: {
  donnees: DonneesModule;
  ouvrirModule: (id: WidgetId) => void;
  /** Une page d'un espace, sur un onglet précis (la nouveauté annoncée par la fée). */
  ouvrirOnglet: (id: WidgetId, onglet?: string) => void;
  ouvrirReglages: () => void;
  ouvrirMots: () => void;
  ouvrirJarvis: () => void;
  ouvrirFil: () => void;
  /** Les réglages où mène la carte de mise en route. */
  ouvrirReglage: (ou: "telephone" | "partage" | "notifications" | "siri") => void;
  partageActif: boolean;
  ouvrirBilan: () => void;
  ouvrirRappels: () => void;
  ouvrirSauvegarde: () => void;
  ouvrirNotifications: () => void;
  ouvrirPartage: () => void;
  /** Envoie et reçoit les changements tout de suite ; absent sans partage. */
  synchroniser?: () => Promise<void>;
  ouvrirRepartition: () => void;
  aller: (ou: OuRecherche) => void;
  depot: Depot;
  jarvis: { serveur: ServeurJarvis; foyerId: string } | null;
  /** Une nouvelle version attend : pastille rouge sur les Réglages. */
  nouvelleVersion: boolean;
  partage: EtatPartage;
  rappelsNonLus: number;
  /** Aucune page n'est ouverte par-dessus : les gestes de l'accueil sont à lui. */
  auDessus: boolean;
}) {
  const [retirees, setRetirees] = useState<CarteId[]>(lireRetirees);
  // Une carte retirée depuis le bilan : l'accueil, resté ouvert dessous, relit ses piles.
  const versionLocale = useApprentissageLocal();
  useEffect(() => {
    if (versionLocale) setRetirees(lireRetirees());
  }, [versionLocale]);
  const [ranger, setRanger] = useState(false);
  const [apercu, setApercu] = useState<TuileChiffre["id"] | null>(null);
  const [signes, setSignes] = useState<Signe[]>(lireSignes);
  const [heureDe, setHeureDe] = useState<Tache | null>(null);
  const haut = useRef<HTMLElement>(null);
  // « Glisse quand c'est fait » : les trois premières fois, et plus jamais une fois le geste fait.
  const [indice, setIndice] = useState(() => {
    const e = lireIndiceGlisse();
    return montrerIndice(e.vues, e.geste);
  });
  useEffect(() => {
    if (!indice) return;
    const e = lireIndiceGlisse();
    enregistrerIndiceGlisse({ ...e, vues: e.vues + 1 });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Les rappels n'arrivent plus sur ce téléphone (nouvelle installation, autorisation retirée) :
  // l'accueil le dit, sinon on attend des notifications qui ne viennent jamais.
  const [notificationsCoupees, setNotificationsCoupees] = useState(false);
  useEffect(() => {
    let vivant = true;
    // Seulement dans l'app installée : c'est là que les rappels arrivent.
    if (!matchMedia("(display-mode: standalone)").matches) return;
    void etatRappels()
      .then((e) => vivant && setNotificationsCoupees(e === "inactifs" || e === "refuses"))
      .catch(ignorer);
    return () => {
      vivant = false;
    };
  }, [props.auDessus]);
  const { foyer, membreId, aujourdhui } = props.donnees;
  const moi = foyer.membres.find((m) => m.id === membreId);
  const annoncer = useAnnoncer();
  const maintenant = new Date();
  const heureTexte = heureMinute(maintenant);
  // La visite guidée attend que l'accueil soit posé, tout en haut.
  const visiteDemandee = useSyncExternalStore(abonnerVisite, visiteEnAttente);
  const [visite, setVisite] = useState(false);
  useEffect(() => {
    if (!visiteDemandee || !props.auDessus) return;
    const id = setTimeout(() => {
      window.scrollTo(0, 0);
      setVisite(true);
    }, 700);
    return () => clearTimeout(id);
  }, [visiteDemandee, props.auDessus]);
  const autre = foyer.membres.find((m) => m.id !== membreId)?.prenom ?? null;
  // Tout tient sur un écran : la page ne défile plus, les zones (« Ce soir », les piles) se glissent.
  useAccueilFixe(props.auDessus, haut);

  const changerRetirees = (r: CarteId[]) => {
    setRetirees(r);
    enregistrerRetirees(r);
  };
  // Ce que montre chaque espace, calculé par son module.
  const apercus = new Map<WidgetId, ApercuWidget>();
  for (const id of ["taches", "courses", "maison", "chef", "agenda", "budget"] as const) {
    const module = MODULES[id];
    if (module) apercus.set(id, module.widget(props.donnees));
  }
  const apercuDe = (id: WidgetId) => apercus.get(id)!;

  const adaptations = lireAdaptations();
  const heure = maintenant.getHours();
  // L'accueil qui s'adapte : les piles suivent le moment ; sans lui, elles gardent celles du soir.
  const moment = adaptations.accueilVivant ? momentAccueil(heure, maintenant.getDay()) : "soir";

  // Le bilan du dimanche attend qu'on le regarde ; le mot du jour de Jarvis, une fois par jour au plus.
  const appris = bilanDeLaSemaine(calculerApprentissages(props.donnees));
  const bilanPret = bilanAOuvrir(aujourdhui, lireDernierBilan(), appris.length);
  const remarque = adaptations.remarques ? remarqueDuJour({ ...props.donnees, membreId }) : null;
  const montrerRemarque = remarqueAMontrer(remarque?.cle ?? null, aujourdhui);

  // Le mot du jour, puis le clin d'œil du foyer : la fée les dit une fois, quand l'accueil est calme.
  useClinDuJour({ donnees: props.donnees, depot: props.depot, jarvis: props.jarvis });
  const clin = clinDuJour(props.donnees.couple, aujourdhui);
  // Après une mise à jour, la nouveauté passe avant tout le reste, une seule fois.
  const nouveaute = nouveauteADire(__VERSION__, lireTexte(CLES.nouveauteVue), props.donnees.elements.length + props.donnees.taches.length > 0);
  const aDire = nouveaute ? `nouveaute:${nouveaute.version}` : remarque && montrerRemarque ? `remarque:${remarque.cle}` : clin && !clinDejaDit(aujourdhui) ? `clin:${aujourdhui}` : null;
  useEffect(() => {
    if (!aDire || !props.auDessus || visite) return;
    // Elle attend un moment calme pour parler, et réessaie tant qu'elle n'a pas pu.
    const id = setInterval(() => {
      if (aDire.startsWith("nouveaute:") && nouveaute) {
        const dit = direSiCalme({ cle: aDire, texte: nouveaute.texte, actions: [{ texte: "Voir", faire: () => props.ouvrirOnglet(nouveaute.ou.id, nouveaute.ou.onglet) }, { texte: "Merci" }] });
        // Stockage indisponible : elle le redira à la prochaine ouverture.
        if (dit) ecrireTexte(CLES.nouveauteVue, nouveaute.version);
      } else if (aDire.startsWith("remarque:") && remarque) {
        const module = remarque.module;
        const dit = direSiCalme({ cle: aDire, texte: remarque.texte, actions: module ? [{ texte: "Voir", faire: () => props.ouvrirModule(module) }, { texte: "Merci" }] : [{ texte: "Merci" }] });
        if (dit) fermerRemarque(remarque.cle, aujourdhui);
      } else if (clin && direSiCalme({ cle: aDire, texte: clin.texte })) noterClinDit(aujourdhui);
    }, 2500);
    return () => clearInterval(id);
  }, [aDire, props.auDessus, visite]); // eslint-disable-line react-hooks/exhaustive-deps
  // En quittant l'accueil, ce qu'elle disait d'ici se tait.
  useEffect(() => {
    if (!props.auDessus) taireFee();
  }, [props.auDessus]);

  const evenements = evenementsDe(props.donnees.agenda);
  const valeursSignes = signesDuJour(signes, { ...props.donnees, evenements, heure: heureTexte });
  const derniereSauvegarde = lireDerniereSauvegarde();
  // La nuit tombée le soir, la carte montre déjà demain.
  const { montrer } = nuitDeCeTelephone(aujourdhui, maintenant);
  const jourCarte = montrer === "demain" ? decaler(aujourdhui, { unite: "jour", tous: 1 }) : aujourdhui;
  const carte = carteDuJour({
    ...props.donnees,
    aujourdhui: jourCarte,
    evenements,
    factures: facturesDuJour(props.donnees.budget, aujourdhui, 1),
    sauvegardeDue: sauvegardeDue(derniereSauvegarde, aujourdhui) && maintenant.getDay() === 0,
    repartitionDue: repartitionDue(foyer, props.donnees.taches, aujourdhui, lireDerniereRepartition()),
    dechets: reglageDechets(props.donnees.maison),
  }, CHOSES_CARTE);
  const cocherChose = async (c: ChoseDuJour) => {
    const avant = props.donnees.taches.find((t) => t.id === c.tacheId);
    if (!avant) return;
    vibrer();
    // La dernière chose du jour : « Tout est fait », avec une gerbe de confettis.
    const derniere = resteAFaire(carte) === 1;
    const apres = marquerFaite(avant, membreId, aujourdhui, contexteReel);
    await props.depot.enregistrerTache(apres);
    feteFee();
    if (derniere) feter(document.querySelector(".ce-moment"));
    noterUsage("tache", avant.id);
    const suite = apres.recurrence ? ` Prochaine fois ${decrireEcheance(apres.echeance, aujourdhui)}.` : "";
    annoncer(`« ${avant.titre} » faite.${suite}`, () => props.depot.enregistrerTache(avant));
  };
  const ouvrirEspace = (id: WidgetId) => {
    noterUsage("widget", id);
    props.ouvrirModule(id);
  };
  const toucherChose = (c: ChoseDuJour) => {
    if (c.destination === "sauvegarde") props.ouvrirSauvegarde();
    else if (c.destination === "repartition") props.ouvrirRepartition();
    else ouvrirEspace(c.destination);
  };
  // La vie de la fée : sommeil, alertes, l'heure des tâches, le réveil, le jour J.
  const agenda = resumeAgenda(evenements, props.donnees.animaux, aujourdhui);
  const prochainRdv = agenda.aujourdhui.find((o) => !o.evenement.heure || o.evenement.heure >= heureTexte) ?? agenda.semaine[0];
  useVieFee({
    actif: props.auDessus && !visite,
    aujourdhui,
    carte,
    taches: props.donnees.taches,
    membreId,
    autre,
    couple: props.donnees.couple,
    meteo: props.donnees.meteo,
    listes: props.donnees.listes,
    elements: props.donnees.elements,
    rdv: prochainRdv ? ligneWidget(prochainRdv, aujourdhui).replace(" · ", ", ") : null,
    ouvrir: (destination) => toucherChose({ destination } as unknown as ChoseDuJour),
    cocher: (c) => void cocherChose(c),
    repousser: (c) => {
      const t = props.donnees.taches.find((x) => x.id === c.tacheId);
      if (!t) return;
      const dans = new Date(Date.now() + 15 * 60_000);
      const heure = heureMinute(dans);
      void props.depot.enregistrerTache({ ...t, heure });
    },
  });
  const quiFait = (c: ChoseDuJour) => {
    const t = props.donnees.taches.find((x) => x.id === c.tacheId);
    if (!t) return null;
    if (t.responsable === null) return "libre";
    return foyer.membres.find((m) => m.id === t.responsable)?.prenom ?? null;
  };
  const ouvrirSigne = (v: ValeurSigne) => {
    if (v.destination === "mots") props.ouvrirMots();
    else props.ouvrirModule(v.destination);
  };

  // ----- Les quatre chiffres du jour -----
  const dues = compterDues(props.donnees.taches, aujourdhui);
  const plan = planDe(props.donnees.budget);
  const soldeCourses = plan ? etatDesPots(plan, props.donnees.budget, aujourdhui).courses.solde : 0;
  const rdv = tuileAgenda(prochainRdv, aujourdhui);
  const totalDues = dues.aujourdhui + dues.enRetard;
  const tuiles: TuileChiffre[] = [
    { id: "taches", libelle: "Tâches", valeur: String(totalDues), pied: dues.enRetard ? `${dues.enRetard} en retard` : totalDues ? "à faire" : "rien", urgent: dues.enRetard > 0 },
    { id: "courses", libelle: "Courses", valeur: String(apercuDe("courses").chiffre), pied: apercuDe("courses").chiffre ? "à prendre" : "liste vide", urgent: false },
    plan
      ? { id: "budget", libelle: "Budget", valeur: String(Math.max(0, Math.floor(soldeCourses))), pied: apercuDe("budget").urgent ? "facture à payer" : "CHF courses", urgent: apercuDe("budget").urgent }
      : { id: "budget", libelle: "Budget", valeur: "—", pied: "à créer", urgent: false },
    { id: "agenda", libelle: "Agenda", valeur: rdv.valeur, pied: rdv.pied, urgent: false },
  ];
  const contenuApercu = (id: TuileChiffre["id"]) =>
    id === "taches"
      ? { contexte: contexteDe(apercuDe("taches")), lignes: carte.choses.slice(0, 4).map((c) => ({ texte: c.texte, fin: c.quand, urgent: c.etat === "urgent" })) }
      : { contexte: contexteDe(apercuDe(id)), lignes: lignesDe(apercuDe(id)) };

  // ----- Les piles « En ce moment » -----
  const filEntrees = filDuFoyer(props.donnees, maintenant.toISOString());
  const jourLocal = (iso: string) => aujourdhuiLocal(new Date(iso));
  const cartePile = (id: CarteId): CartePile => {
    const base = { id, titre: CARTES.find((c) => c.id === id)!.titre, picto: PICTO_CARTE[id] };
    if (id === "fil") {
      const resume = resumeDuJour(filEntrees, aujourdhui, jourLocal, foyer, membreId);
      return {
        ...base,
        contexte: resume ? `Aujourd'hui : ${resume}` : filEntrees.length ? "Rien de neuf aujourd'hui" : "Ce que chacun fait, au fil des jours",
        lignes: filEntrees.slice(0, 2).map((e) => ({ texte: `${quiDe(e, foyer, membreId)} ${e.texte}`, fin: jourLocal(e.quand) === aujourdhui ? heureMinute(new Date(e.quand)) : "avant" })),
        urgent: false,
        ouvrir: props.ouvrirFil,
      };
    }
    if (id === "bilan") {
      return {
        ...base,
        contexte: appris.length === 1 ? "Une chose apprise, à garder ou non" : `${appris.length} choses apprises, à garder ou non`,
        lignes: appris.slice(0, 2).map((a) => ({ texte: a.texte, fin: "" })),
        urgent: false,
        ouvrir: props.ouvrirBilan,
      };
    }
    const a = apercuDe(id);
    return {
      ...base,
      contexte: id === "budget" && plan && !a.legende.includes("clôturer") && !a.legende.includes("noter") ? `${Math.max(0, Math.floor(soldeCourses))} CHF sur la carte courses` : contexteDe(a),
      lignes: lignesDe(a),
      urgent: a.urgent,
      widget: id,
      ouvrir: () => ouvrirEspace(id),
    };
  };
  const urgentes = new Set<CarteId>((["maison", "chef", "courses", "agenda", "budget"] as const).filter((id) => apercuDe(id).urgent));
  const piles = composerPiles(moment, { urgentes, retirees: new Set(retirees), absentes: new Set<CarteId>(bilanPret ? [] : ["bilan"]) });
  const direct = enDirect({ ...props.donnees, foyer, membreId }, maintenant.toISOString());
  const titreCeSoir = montrer === "demain" ? "Demain" : moment === "dimanche" ? "Aujourd'hui" : titreMoment(heure);

  return (
    <main className="tableau accueil accueil-un-ecran">
      <header className="haut-accueil" ref={haut}>
        <GrandeDate date={maintenant} />
        <Signes valeurs={valeursSignes} choisis={signes} changer={setSignes} toucher={ouvrirSigne} />
        {/* Depuis 0.0.73 : plus de geste « tirer vers le bas ». On cherche en écrivant à la fée ;
            Réglages, une petite roue discrète en haut à droite, et la cloche seulement quand un rappel attend. */}
        <span className="coin-accueil">
          {props.rappelsNonLus > 0 && (
            <button className="coin-bouton avec-alerte" onClick={props.ouvrirRappels} aria-label={`Rappels, ${props.rappelsNonLus} nouveaux`}>
              <Icone nom="cloche" taille={18} />
              <span className="alerte" aria-hidden />
            </button>
          )}
          <button className="coin-bouton avec-alerte" onClick={props.ouvrirReglages} aria-label={props.nouvelleVersion ? "Réglages, nouvelle version disponible" : "Réglages"}>
            <Icone nom="reglages" taille={18} />
            {props.nouvelleVersion && <span className="alerte" aria-hidden />}
          </button>
        </span>
        {/* La date tient lieu de salutation ; le titre reste pour VoiceOver. */}
        <h1 className="cache-visuel">
          {salutation(heure)}
          {moi ? `, ${moi.prenom}` : ""}
        </h1>
      </header>

      {direct && <PastilleDirect direct={direct} ouvrir={() => ouvrirEspace("courses")} />}

      <CarteDemarrage
        foyer={foyer}
        membreId={membreId}
        partageActif={props.partageActif}
        taches={props.donnees.taches}
        ouvrir={(ou) => (ou === "taches" ? props.ouvrirModule("taches") : props.ouvrirReglage(ou))}
      />

      <ChiffresDuJour tuiles={tuiles} ouvrir={ouvrirEspace} apercu={setApercu} />

      <CeSoir
        choses={carte.choses}
        titre={titreCeSoir}
        vide={carte.faites ? "Tout est fait. Belle journée." : "Rien de prévu, rien ne presse."}
        qui={quiFait}
        toucher={toucherChose}
        cocher={(c) => void cocherChose(c)}
        changerHeure={(c) => setHeureDe(props.donnees.taches.find((t) => t.id === c.tacheId) ?? null)}
        voirTout={() => ouvrirEspace("taches")}
        indice={indice}
        gesteFait={() => {
          setIndice(false);
          enregistrerIndiceGlisse({ ...lireIndiceGlisse(), geste: true });
        }}
      />

      <section className="en-ce-moment" aria-label="En ce moment">
        <header className="accueil-titre">
          <h2>En ce moment</h2>
          <span className="discret">{RAISON_DU_MOMENT[moment]}</span>
        </header>
        {piles[0].length > 0 && <Pile key={`haut-${piles[0].join()}`} nom="À faire" cartes={piles[0].map(cartePile)} ranger={() => setRanger(true)} />}
        {piles[1].length > 0 && <Pile key={`bas-${piles[1].join()}`} nom="À consulter" cartes={piles[1].map(cartePile)} ranger={() => setRanger(true)} />}
        {piles[0].length + piles[1].length === 0 && (
          <button className="carte vide-tableau" onClick={() => setRanger(true)}>
            Les piles sont vides. Touche ici pour remettre des cartes.
          </button>
        )}
      </section>

      {/* Le partage et la sauvegarde vivent dans Réglages : ici seulement quand il y a un souci. */}
      <footer className="pied-accueil">
        {(props.partage.ton === "urgent" || props.partage.horsLigne) && (
          <button className={`etat-pied ${props.partage.ton}`} onClick={props.ouvrirPartage}>
            <span className={`point-etat ${props.partage.ton}`} aria-hidden />
            {props.partage.texte}
          </button>
        )}
        {notificationsCoupees && (
          <button className="etat-pied urgent" onClick={props.ouvrirNotifications}>
            <span className="point-etat urgent" aria-hidden />
            Notifications coupées sur ce téléphone
          </button>
        )}
        {props.synchroniser && <BoutonSynchro synchroniser={props.synchroniser} />}
        {sauvegardeDue(derniereSauvegarde, aujourdhui) && (
          <button className="etat-pied" onClick={props.ouvrirSauvegarde}>
            <Icone nom="sauvegarde" taille={15} />
            Sauvegarde : {decrireDerniere(derniereSauvegarde, aujourdhui)}
          </button>
        )}
      </footer>

      {/* Le bas de l'écran s'efface dans le fond, comme sous la barre d'iOS (le haut a la date repliée). */}
      {props.auDessus && createPortal(<div className="fondu-bord" aria-hidden />, document.body)}

      {visite && (
        <Visite
          autre={membreId ? autre : null}
          fermer={() => {
            setVisite(false);
            finirVisite();
          }}
        />
      )}

      <FeuilleHeure
        tache={heureDe}
        fermer={() => setHeureDe(null)}
        enregistrer={(t) => {
          setHeureDe(t);
          void props.depot.enregistrerTache(t);
        }}
      />

      <Feuille ouverte={apercu !== null} onFermer={() => setApercu(null)} titre={tuiles.find((t) => t.id === apercu)?.libelle}>
        {apercu && (
          <ContenuApercu
            {...contenuApercu(apercu)}
            libelle={tuiles.find((t) => t.id === apercu)!.libelle}
            ouvrir={() => {
              const id = apercu;
              setApercu(null);
              ouvrirEspace(id);
            }}
          />
        )}
      </Feuille>

      <Feuille ouverte={ranger} onFermer={() => setRanger(false)} titre="Les piles de l'accueil">
        <p className="discret">Kora les range selon le moment, et ce qui presse monte en haut. Ce choix reste sur ce téléphone.</p>
        <ul className="carte groupe">
          {CARTES.map((c) => {
            const garde = !retirees.includes(c.id);
            return (
              <li key={c.id}>
                <button
                  className="ligne ligne-reglage"
                  role="checkbox"
                  aria-checked={garde}
                  onClick={() => {
                    vibrer();
                    changerRetirees(basculerRetiree(retirees, c.id));
                  }}
                >
                  <span className="picto-reglage"><Icone nom={PICTO_CARTE[c.id]} taille={17} /></span>
                  <span className="ligne-texte">{c.titre}</span>
                  {garde && <span className="coche-reglage"><Icone nom="coche" taille={18} /></span>}
                </button>
              </li>
            );
          })}
        </ul>
      </Feuille>

      {props.auDessus && <RechercheFee donnees={props.donnees} aller={props.aller} ouvrirModule={ouvrirEspace} />}
    </main>
  );
}

/** « Synchroniser » : la synchro passe déjà seule, mais on peut la demander d'un toucher. */
function BoutonSynchro({ synchroniser }: { synchroniser: () => Promise<void> }) {
  const [enCours, setEnCours] = useState(false);
  const lancer = async () => {
    if (enCours) return;
    vibrer();
    setEnCours(true);
    try {
      // Assez long pour voir que ça tourne, même quand tout est déjà à jour.
      await Promise.all([synchroniser().catch(ignorer), new Promise((r) => setTimeout(r, 600))]);
    } finally {
      setEnCours(false);
    }
  };
  return (
    <button className={`etat-pied bouton-synchro${enCours ? " en-cours" : ""}`} onClick={() => void lancer()} disabled={enCours}>
      <Icone nom="actualiser" taille={15} />
      {enCours ? "Synchronisation…" : "Synchroniser"}
    </button>
  );
}

/**
 * L'accueil est une page fixe (Kora 0.0.73, puis 0.0.74 à la demande de Melo) : la page ne
 * défile jamais, elle prend la hauteur de l'écran. « Ce soir » et les piles reçoivent tous les
 * glissements ; si « En ce moment » manque de place, il se resserre (une ligne par carte), puis
 * défile seul dans sa zone.
 */
function useAccueilFixe(actif: boolean, haut: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const page = haut.current?.closest("main");
    const zone = page?.querySelector<HTMLElement>(".en-ce-moment");
    if (!actif || !page || !zone) return;
    const racine = document.documentElement;
    racine.classList.add("accueil-fixe");
    window.scrollTo(0, 0);
    const mesurer = () => {
      racine.classList.remove("accueil-serre");
      if (zone.scrollHeight > zone.clientHeight + 1) racine.classList.add("accueil-serre");
    };
    mesurer();
    const suivi = new ResizeObserver(mesurer);
    suivi.observe(page);
    for (const enfant of zone.children) suivi.observe(enfant);
    window.addEventListener("resize", mesurer);
    return () => {
      suivi.disconnect();
      window.removeEventListener("resize", mesurer);
      racine.classList.remove("accueil-fixe", "accueil-serre");
    };
  }, [actif, haut]);
}
