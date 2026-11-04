import { useEffect, useEffectEvent, useState } from "react";
import type { Depot } from "../../donnees/depot";
import type { ServeurJarvis } from "../../donnees/distant";
import { resiliationsDuJour } from "../../domaine/abonnements";
import { evenementsDe, ligneWidget, occurrences, resumeAgenda, titreDe } from "../../domaine/agenda";
import { etatAMoi } from "../../domaine/aMoi";
import { bilanAOuvrir, bilanDeLaSemaine, remarqueDuJour } from "../../domaine/apprentissage";
import { carteDuJour, resteAFaire, titreMoment, type ChoseDuJour } from "../../domaine/aujourdhui";
import { basculerCoeur, clinDuJour } from "../../domaine/bandeau";
import { etatDesPots, facturesDuJour, formaterMontant, planDe } from "../../domaine/budget";
import { enDirect } from "../../domaine/ecranAccueil";
import type { EtatPartage } from "../../domaine/etatPartage";
import { filDuFoyer, quiDe, resumeDuJour } from "../../domaine/fil";
import { ligneRetard } from "../../domaine/foyer";
import { composerHub } from "../../domaine/hub";
import { reglageDechets } from "../../domaine/maison";
import { meteoDu } from "../../domaine/meteo";
import { nouveauteADire } from "../../domaine/nouveautes";
import type { OuRecherche } from "../../domaine/recherche";
import { repartitionDue } from "../../domaine/repartition";
import { decrireDerniere, sauvegardeDue } from "../../domaine/sauvegarde";
import { compterDues, decaler, decrireEcheance, marquerFaite } from "../../domaine/taches";
import { salutation } from "../../domaine/tael";
import { heureMinute } from "../../domaine/texte";
import type { Tache } from "../../domaine/types";
import type { WidgetId } from "../../domaine/tableauDeBord";
import { useAnnoncer } from "../annulation";
import { calculerApprentissages } from "../apprendre";
import { clinDejaDit, noterClinDit, useClinDuJour } from "../clinDuJour";
import { aujourdhuiLocal, contexteReel } from "../contexte";
import { direSiCalme, feteFee, taireFee } from "../fee";
import { vibrer } from "../haptique";
import { Icone } from "../Icone";
import { ignorer } from "../journal";
import { MODULES, type DonneesModule } from "../modules";
import { feter } from "../moteur/fete";
import type { Page } from "../pages";
import { CarteDemarrage } from "../pieces/Demarrage";
import { dateLongue, enLettres, EnteteEspace, Grille, Jours, Tuile } from "../pieces/Cartes";
import { FeuilleHeure } from "../pieces/FeuilleHeure";
import { RechercheFee } from "../pieces/RechercheFee";
import { CarteTael } from "../pieces/Tael";
import { etatRappels } from "../rappels";
import { lireDerniereSauvegarde } from "../sauvegarde";
import { sauver } from "../sauver";
import { CLES, ecrireTexte, lireTexte } from "../stockageLocal";
import { ecrireAFee } from "../tael";
import { fermerRemarque, lireAdaptations, lireDernierBilan, noterUsage, remarqueAMontrer } from "../usage";
import { nuitDeCeTelephone, useVieFee } from "../vieFee";
import { lireDerniereRepartition } from "./Taches";

// Aujourd'hui (Kora 0.1) : le premier des six espaces, d'après la maquette validée par Melo le
// 4 novembre 2026. Le salut et Tael à côté, puis des cartes tirées des données du foyer : sa carte
// à elle, « Ce soir » en héros, ce qui est à toi maintenant en laiton, les courses, les tâches,
// la semaine de l'agenda, le seul grand chiffre (à toi ce mois), le mot de l'autre, demain en
// ivoire, le fil « Chez nous ». Ce qui presse monte ; ce qui n'a rien à dire ne s'affiche pas.

/** Combien de choses du jour la carte du jour retient. */
const CHOSES_CARTE = 12;

export function Aujourdhui(props: {
  donnees: DonneesModule;
  depot: Depot;
  jarvis: { serveur: ServeurJarvis; foyerId: string } | null;
  partageActif: boolean;
  partage: EtatPartage;
  rappelsNonLus: number;
  ouvrir: (p: Page) => void;
  /** Envoie et reçoit les changements tout de suite ; absent sans partage. */
  synchroniser?: () => Promise<void>;
  ouvrirRepartition: () => void;
  aller: (ou: OuRecherche) => void;
  /** Aucune page n'est ouverte par-dessus : la fée parle d'ici. */
  auDessus: boolean;
}) {
  const { donnees, depot, ouvrir } = props;
  const { foyer, membreId, aujourdhui } = donnees;
  const moi = foyer.membres.find((m) => m.id === membreId);
  const autre = foyer.membres.find((m) => m.id !== membreId) ?? null;
  const annoncer = useAnnoncer();
  const maintenant = new Date();
  const heureTexte = heureMinute(maintenant);
  const [heureDe, setHeureDe] = useState<Tache | null>(null);

  // Les rappels n'arrivent plus sur ce téléphone (nouvelle installation, autorisation retirée) : on le dit.
  const [notificationsCoupees, setNotificationsCoupees] = useState(false);
  useEffect(() => {
    let vivant = true;
    if (!matchMedia("(display-mode: standalone)").matches) return;
    void etatRappels()
      .then((e) => vivant && setNotificationsCoupees(e === "inactifs" || e === "refuses"))
      .catch(ignorer);
    return () => {
      vivant = false;
    };
  }, [props.auDessus]);

  const ouvrirEspace = (id: WidgetId, onglet?: string) => {
    noterUsage("widget", id);
    ouvrir({ nom: "module", id, onglet });
  };

  // ----- Ce que les modules disent d'eux -----
  const apercu = (id: WidgetId) => MODULES[id]!.widget(donnees);
  const courses = apercu("courses");
  const evenements = evenementsDe(donnees.agenda);
  const derniereSauvegarde = lireDerniereSauvegarde();
  // La nuit tombée le soir, la carte montre déjà demain.
  const { montrer } = nuitDeCeTelephone(aujourdhui, maintenant);
  const jourCarte = montrer === "demain" ? decaler(aujourdhui, { unite: "jour", tous: 1 }) : aujourdhui;
  const carte = carteDuJour(
    {
      ...donnees,
      aujourdhui: jourCarte,
      evenements,
      factures: facturesDuJour(donnees.budget, aujourdhui, 1),
      resiliations: resiliationsDuJour(donnees.budget, aujourdhui),
      sauvegardeDue: sauvegardeDue(derniereSauvegarde, aujourdhui) && maintenant.getDay() === 0,
      repartitionDue: repartitionDue(foyer, donnees.taches, aujourdhui, lireDerniereRepartition()),
      dechets: reglageDechets(donnees.maison),
    },
    CHOSES_CARTE,
  );
  const hub = composerHub({
    foyer,
    membreId,
    aujourdhui: jourCarte,
    maintenant: maintenant.toISOString(),
    choses: carte.choses,
    menus: donnees.menus,
    listes: donnees.listes,
    elements: donnees.elements,
    evenements,
    animaux: donnees.animaux,
    dechets: reglageDechets(donnees.maison),
    couple: donnees.couple,
    zones: donnees.zones,
    meteo: donnees.meteo,
  });

  const cocherChose = async (c: ChoseDuJour) => {
    const avant = donnees.taches.find((t) => t.id === c.tacheId);
    if (!avant) return;
    vibrer();
    const derniere = resteAFaire(carte) === 1;
    const apres = marquerFaite(avant, membreId, aujourdhui, contexteReel);
    await depot.enregistrerTache(apres);
    feteFee();
    if (derniere) feter(document.querySelector(".page-dessus .grille"));
    noterUsage("tache", avant.id);
    const suite = apres.recurrence ? ` Prochaine fois ${decrireEcheance(apres.echeance, aujourdhui)}.` : "";
    annoncer(`« ${avant.titre} » faite.${suite}`, () => depot.enregistrerTache(avant));
  };
  const toucherChose = (c: Pick<ChoseDuJour, "destination">) => {
    if (c.destination === "sauvegarde") ouvrir({ nom: "sauvegarde" });
    else if (c.destination === "repartition") props.ouvrirRepartition();
    else if (c.destination === "administratif") ouvrirEspace("taches", "administratif");
    else if (c.destination === "taches") ouvrirEspace("taches", "taches");
    else if (c.destination === "agenda") ouvrirEspace("taches", "agenda");
    else if (c.destination === "mitsu" || c.destination === "jardin") ouvrirEspace("maison", c.destination);
    else if (c.destination === "stock") ouvrirEspace("chef", "frigo");
    else if (c.destination === "chef") ouvrirEspace("chef", "semaine");
    else if (c.destination === "maison") ouvrirEspace("maison", "entretien");
    else ouvrirEspace(c.destination);
  };

  // ----- Ce que Tael dit d'elle-même : la nouveauté, la remarque du jour, le clin d'œil -----
  const adaptations = lireAdaptations();
  const appris = bilanDeLaSemaine(calculerApprentissages(donnees));
  const bilanPret = bilanAOuvrir(aujourdhui, lireDernierBilan(), appris.length);
  const remarque = adaptations.remarques ? remarqueDuJour({ ...donnees, membreId }) : null;
  const montrerRemarque = remarqueAMontrer(remarque?.cle ?? null, aujourdhui);
  useClinDuJour({ donnees, depot, jarvis: props.jarvis });
  const clin = clinDuJour(donnees.couple, aujourdhui);
  const nouveaute = nouveauteADire(__VERSION__, lireTexte(CLES.nouveauteVue), donnees.elements.length + donnees.taches.length > 0);
  const aDire = nouveaute ? `nouveaute:${nouveaute.version}` : remarque && montrerRemarque ? `remarque:${remarque.cle}` : clin && !clinDejaDit(aujourdhui) ? `clin:${aujourdhui}` : null;
  const essayerDeDire = useEffectEvent(() => {
    if (!aDire) return;
    if (aDire.startsWith("nouveaute:") && nouveaute) {
      const dit = direSiCalme({ cle: aDire, texte: nouveaute.texte, actions: [{ texte: "Voir", faire: () => ouvrirEspace(nouveaute.ou.id, nouveaute.ou.onglet) }, { texte: "Merci" }] });
      if (dit) ecrireTexte(CLES.nouveauteVue, nouveaute.version);
    } else if (aDire.startsWith("remarque:") && remarque) {
      const module = remarque.module;
      const dit = direSiCalme({ cle: aDire, texte: remarque.texte, actions: module ? [{ texte: "Voir", faire: () => ouvrirEspace(module) }, { texte: "Merci" }] : [{ texte: "Merci" }] });
      if (dit) fermerRemarque(remarque.cle, aujourdhui);
    } else if (clin && direSiCalme({ cle: aDire, texte: clin.texte })) noterClinDit(aujourdhui);
  });
  useEffect(() => {
    if (!aDire || !props.auDessus) return;
    const id = setInterval(essayerDeDire, 2500);
    return () => clearInterval(id);
  }, [aDire, props.auDessus]);
  useEffect(() => {
    if (!props.auDessus) taireFee();
  }, [props.auDessus]);

  // ----- La vie de la fée : sommeil, alertes, l'heure des tâches, le réveil, le jour J -----
  const agenda = resumeAgenda(evenements, donnees.animaux, aujourdhui);
  const prochainRdv = agenda.aujourdhui.find((o) => !o.evenement.heure || o.evenement.heure >= heureTexte) ?? agenda.semaine[0];
  useVieFee({
    actif: props.auDessus,
    aujourdhui,
    carte,
    taches: donnees.taches,
    membreId,
    autre: autre?.prenom ?? null,
    couple: donnees.couple,
    meteo: donnees.meteo,
    listes: donnees.listes,
    elements: donnees.elements,
    rdv: prochainRdv ? ligneWidget(prochainRdv, aujourdhui).replace(" · ", ", ") : null,
    ouvrir: (destination) => (destination === "courses" ? ouvrirEspace("chef", "courses") : toucherChose({ destination })),
    cocher: (c) => void cocherChose(c),
    repousser: (c) => {
      const t = donnees.taches.find((x) => x.id === c.tacheId);
      if (!t) return;
      sauver(depot.enregistrerTache({ ...t, heure: heureMinute(new Date(Date.now() + 15 * 60_000)) }));
    },
  });

  // ----- Les cartes -----
  const heure = maintenant.getHours();
  const meteoJour = meteoDu(donnees.meteo, aujourdhui);
  const sous = `${dateLongue(maintenant)}${meteoJour ? ` · ${Math.round(meteoJour.max)}° dehors` : ""}`;
  // Ce soir : le repas du Chef s'il y en a un, sinon la première chose du jour.
  const ceSoir = hub.menu;
  const premiere = carte.choses[0];
  const titreCeSoir = montrer === "demain" ? "Demain" : titreMoment(heure);
  // À toi, maintenant : la chose la plus pressée qui se coche d'ici.
  const aToi = carte.choses.find((c) => c.tacheId && (c.etat === "urgent" || c.etat === "jour"));
  const dues = compterDues(donnees.taches, aujourdhui);
  const totalDues = dues.aujourdhui + dues.enRetard;
  const direct = enDirect({ ...donnees, foyer, membreId }, maintenant.toISOString());
  const marques = new Set(occurrences(evenements, decaler(aujourdhui, { unite: "jour", tous: -7 }), decaler(aujourdhui, { unite: "jour", tous: 7 }), donnees.animaux).map((o) => o.debut));
  const rdvs = [...agenda.aujourdhui, ...agenda.semaine].slice(0, 2);
  const phraseAgenda = rdvs.length
    ? rdvs.map((o) => ligneWidget(o, aujourdhui).replace(" · ", ", ")).join(" ; ") + "."
    : "Rien de prévu cette semaine.";
  const plan = planDe(donnees.budget);
  const aMoi = plan && membreId ? etatAMoi(plan, donnees.budget, membreId, aujourdhui) : null;
  const pots = plan ? etatDesPots(plan, donnees.budget, aujourdhui) : null;
  const filEntrees = filDuFoyer(donnees, maintenant.toISOString());
  const jourLocal = (iso: string) => aujourdhuiLocal(new Date(iso));
  const resumeFil = resumeDuJour(filEntrees, aujourdhui, jourLocal, foyer, membreId);
  const retard = ligneRetard(foyer, membreId, __VERSION__, maintenant.toISOString());
  const demain = hub.demain[0];
  const demainJour = decaler(aujourdhui, { unite: "jour", tous: 1 });
  const demainEvenement = agenda.semaine.find((o) => o.debut === demainJour);

  let i = 0;
  return (
    <main className="page espace aujourdhui">
      <EnteteEspace titre={`${salutation(heure)}${moi ? ` ${moi.prenom}` : ""}`} sous={sous} />

      <CarteDemarrage
        foyer={foyer}
        membreId={membreId}
        partageActif={props.partageActif}
        taches={donnees.taches}
        ouvrir={(ou) => (ou === "taches" ? ouvrirEspace("taches", "taches") : ouvrir({ nom: ou }))}
      />

      <Grille label="Aujourd'hui">
        <CarteTael vol />

        <Tuile className="heros" large i={i++} widget={ceSoir ? "chef" : premiere ? premiere.destination : "taches"} onClick={() => (ceSoir ? ouvrirEspace("chef", "semaine") : premiere ? toucherChose(premiere) : ouvrirEspace("taches", "taches"))} label={`${titreCeSoir} : ${ceSoir ?? premiere?.texte ?? "rien de prévu"}`}>
          <div className="heros-haut" aria-hidden />
          <div className="heros-corps">
            <div>
              <p className="etiq">{titreCeSoir}</p>
              <p className="titre-c">{ceSoir ?? premiere?.texte ?? (carte.faites ? "Tout est fait. Belle soirée." : "Rien de prévu, rien ne presse.")}</p>
              {ceSoir && premiere && <p className="doux">{premiere.texte}{premiere.quand ? `, ${premiere.quand}` : ""}</p>}
              {!ceSoir && carte.choses.length > 1 && <p className="doux">{carte.choses.length - 1} autre{carte.choses.length > 2 ? "s" : ""} chose{carte.choses.length > 2 ? "s" : ""} aujourd'hui</p>}
            </div>
            {(premiere?.heure || (!ceSoir && premiere?.quand)) && <span className="heros-heure">{premiere.heure ?? premiere.quand}</span>}
          </div>
        </Tuile>

        {aToi && (
          <Tuile forte i={i++} role="group" label={`À toi : ${aToi.texte}`}>
            <p className="etiq">À toi{aToi.quand ? `, ${aToi.quand}` : ""}</p>
            <p className="titre-c">{aToi.texte}</p>
            <div className="actions-c">
              <button type="button" className="pilule" onClick={() => void cocherChose(aToi)}>C'est fait</button>
              {aToi.heure && <button type="button" className="pilule" onClick={() => setHeureDe(donnees.taches.find((t) => t.id === aToi.tacheId) ?? null)}>Plus tard</button>}
            </div>
          </Tuile>
        )}

        <Tuile i={i++} widget="courses" onClick={() => ouvrirEspace("chef", "courses")} label={`Courses : ${courses.chiffre} ${courses.legende}`}>
          <p className="etiq"><Icone nom="panier" taille={18} />Courses</p>
          <p className="phrase">
            {courses.chiffre === 0 ? "Rien à acheter." : direct ? <>{direct.qui} finit les courses, il reste <b>{enLettres(courses.chiffre)}</b> chose{courses.chiffre > 1 ? "s" : ""}.</> : <><b>{enLettres(courses.chiffre).replace(/^./, (c) => c.toUpperCase())}</b> chose{courses.chiffre > 1 ? "s" : ""} à prendre.</>}
          </p>
          {direct && <p className="pastille-k"><b className="navi direct">en direct</b></p>}
        </Tuile>

        <Tuile i={i++} widget="taches" onClick={() => ouvrirEspace("taches", "taches")} label={`Tâches : ${totalDues} ${totalDues ? "à faire" : "rien à faire"}`}>
          <p className="etiq"><Icone nom="coche" taille={18} />Tâches</p>
          <p className="phrase">
            {donnees.taches.length === 0 ? "Aucune tâche pour l'instant." : totalDues === 0 ? `Rien à faire aujourd'hui${carte.faites ? `, ${enLettres(carte.faites)} faite${carte.faites > 1 ? "s" : ""}` : ""}.` : <><b>{enLettres(totalDues).replace(/^./, (c) => c.toUpperCase())}</b> à faire{dues.enRetard ? `, ${enLettres(dues.enRetard)} en retard` : ""}{carte.faites ? `, ${enLettres(carte.faites)} faite${carte.faites > 1 ? "s" : ""}` : ""}.</>}
          </p>
        </Tuile>

        <Tuile large i={i++} widget="agenda" onClick={() => ouvrirEspace("taches", "agenda")} label={`Agenda : ${phraseAgenda}`}>
          <p className="etiq"><Icone nom="calendrier" taille={18} />Agenda</p>
          <Jours aujourdhui={aujourdhui} marques={marques} />
          <p className="phrase" style={{ marginTop: 6 }}>{phraseAgenda}</p>
        </Tuile>

        {plan && (
          <Tuile i={i++} widget="budget" onClick={() => ouvrirEspace("budget")} label={aMoi ? `À toi ce mois : ${formaterMontant(aMoi.reste)}` : `Budget : ${formaterMontant(pots!.courses.solde)} sur la carte courses`}>
            <p className="etiq"><Icone nom="portefeuille" taille={18} />{aMoi ? "À toi ce mois" : "Carte courses"}</p>
            <p className="grand-chiffre">
              {Math.max(0, Math.floor(aMoi ? aMoi.reste : pots!.courses.solde))}<small>CHF</small>
            </p>
            {aMoi?.ecartMoisPrecedent !== null && aMoi?.ecartMoisPrecedent !== undefined && (
              <p className="pastille-k"><b>{aMoi.ecartMoisPrecedent > 0 ? "+" : ""}{Math.round(aMoi.ecartMoisPrecedent)}</b> vs le mois d'avant</p>
            )}
          </Tuile>
        )}

        {hub.mot && autre && (
          <Tuile className="mot" large i={i++} role="group" label={`Mot de ${autre.prenom}`}>
            <p className="etiq"><Icone nom="coeur" taille={18} />{hub.mot.titre.replace(/^De /, "")}</p>
            <q>{hub.mot.mot.texte}</q>
            <div className="actions-c">
              {!hub.mot.coeurDonne && membreId && (
                <button type="button" className="pilule" onClick={() => { vibrer(); sauver(depot.enregistrerCouple(basculerCoeur(hub.mot!.mot, membreId))); }}>Un cœur</button>
              )}
              <button type="button" className="pilule" onClick={() => ouvrir({ nom: "mots" })}>Répondre</button>
            </div>
          </Tuile>
        )}

        <Tuile contraste large i={i++} onClick={() => (demainEvenement ? ouvrirEspace("taches", "agenda") : demain ? ouvrirEspace("maison", "entretien") : ouvrirEspace("taches", "agenda"))} label="Demain">
          <p className="etiq">Demain</p>
          <p className="titre-c">{demainEvenement ? `${titreDe(demainEvenement)}${demainEvenement.evenement.heure ? `, ${demainEvenement.evenement.heure}` : ""}` : demain ? `${demain.texte}${demain.quand !== "journée" && demain.quand !== "matin" ? `, ${demain.quand}` : ""}` : "Rien de prévu demain."}</p>
          {demainEvenement && demain && demain.texte !== titreDe(demainEvenement) && <p className="doux">{demain.texte}</p>}
          {!demainEvenement && !demain && hub.balcon?.demain && <p className="doux">{hub.balcon.demain.replace(/^./, (c) => c.toUpperCase())}.</p>}
        </Tuile>

        <Tuile large i={i++} widget="fil" onClick={() => ouvrir({ nom: "fil" })} label="Chez nous, cette semaine">
          <p className="etiq"><Icone nom="activite" taille={18} />Chez nous{resumeFil ? ", aujourd'hui" : ", ces sept jours"}</p>
          <p className="doux" style={{ fontSize: 15 }}>
            {retard ? `${retard}. ` : ""}
            {filEntrees.length === 0 ? "Ce que chacun fait, au fil des jours : rien encore." : resumeFil ? `${resumeFil}. ` : ""}
            {filEntrees.slice(0, 2).map((e) => `${quiDe(e, foyer, membreId)} ${e.texte}`).join(". ")}
            {filEntrees.length ? "." : ""}
          </p>
        </Tuile>

        {hub.balcon && (
          <Tuile i={i++} widget="jardin" onClick={() => ouvrirEspace("maison", "jardin")} label={`Balcon : ${hub.balcon.geste}`}>
            <p className="etiq"><Icone nom="feuille" taille={18} />Balcon</p>
            <div className="meteo-c">
              {hub.balcon.nuit && <span className="deg">{hub.balcon.nuit}</span>}
              <p className="doux">{hub.balcon.demain ? `${hub.balcon.demain.replace(/^./, (c) => c.toUpperCase())}. ` : ""}{hub.balcon.geste}</p>
            </div>
          </Tuile>
        )}

        {bilanPret && (
          <Tuile i={i++} onClick={() => ouvrir({ nom: "bilan" })} label="Bilan de la semaine">
            <p className="etiq"><Icone nom="appris" taille={18} />Bilan</p>
            <p className="phrase">{appris.length === 1 ? "Une chose apprise, à garder ou non." : `${enLettres(appris.length).replace(/^./, (c) => c.toUpperCase())} choses apprises, à garder ou non.`}</p>
          </Tuile>
        )}

        {props.rappelsNonLus > 0 && (
          <Tuile i={i++} onClick={() => ouvrir({ nom: "rappels" })} label={`Rappels, ${props.rappelsNonLus} nouveaux`}>
            <p className="etiq"><Icone nom="cloche" taille={18} />Rappels</p>
            <p className="phrase"><b>{enLettres(props.rappelsNonLus).replace(/^./, (c) => c.toUpperCase())}</b> envoyé{props.rappelsNonLus > 1 ? "s" : ""} par Kora, pas encore relu{props.rappelsNonLus > 1 ? "s" : ""}.</p>
          </Tuile>
        )}
      </Grille>

      {/* Le partage et la sauvegarde vivent dans Réglages : ici seulement quand il y a un souci. */}
      <footer className="pied-espace">
        {(props.partage.ton === "urgent" || props.partage.horsLigne) && (
          <button type="button" className={`etat-pied ${props.partage.ton}`} onClick={() => ouvrir({ nom: "partage" })}>
            <span className={`point-etat ${props.partage.ton}`} aria-hidden />
            {props.partage.texte}
          </button>
        )}
        {notificationsCoupees && (
          <button type="button" className="etat-pied urgent" onClick={() => ouvrir({ nom: "notifications" })}>
            <span className="point-etat urgent" aria-hidden />
            Notifications coupées sur ce téléphone
          </button>
        )}
        {props.synchroniser && <BoutonSynchro synchroniser={props.synchroniser} />}
        {sauvegardeDue(derniereSauvegarde, aujourdhui) && (
          <button type="button" className="etat-pied" onClick={() => ouvrir({ nom: "sauvegarde" })}>
            <Icone nom="sauvegarde" taille={15} />
            Sauvegarde : {decrireDerniere(derniereSauvegarde, aujourdhui)}
          </button>
        )}
        <button type="button" className="etat-pied" onClick={ecrireAFee}>Écrire à {moi ? "ta fée" : "la fée"}</button>
      </footer>

      <FeuilleHeure
        tache={heureDe}
        fermer={() => setHeureDe(null)}
        enregistrer={(t) => {
          setHeureDe(t);
          sauver(depot.enregistrerTache(t));
        }}
      />

      {props.auDessus && <RechercheFee donnees={donnees} aller={props.aller} ouvrirModule={(id) => ouvrirEspace(id)} />}
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
      await Promise.all([synchroniser().catch(ignorer), new Promise((r) => setTimeout(r, 600))]);
    } finally {
      setEnCours(false);
    }
  };
  return (
    <button type="button" className={`etat-pied${enCours ? " en-cours" : ""}`} onClick={() => void lancer()} disabled={enCours}>
      <Icone nom="actualiser" taille={15} />
      {enCours ? "Synchronisation…" : "Synchroniser"}
    </button>
  );
}
