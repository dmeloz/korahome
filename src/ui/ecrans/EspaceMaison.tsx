import type { Depot } from "../../donnees/depot";
import { organiserEntretien } from "../../domaine/entretien";
import { gestesDuJardin } from "../../domaine/jardin";
import { aSortirCeSoir, carnetDe, phraseSortir, rangementsDe, reglageDechets } from "../../domaine/maison";
import { decrireTemps, formaterTemperatures, meteoDu } from "../../domaine/meteo";
import { choseAFaire, decrireAge, formaterPoids, poidsDeReference } from "../../domaine/mitsu";
import { decrireEcheance, marquerFaite } from "../../domaine/taches";
import type { Tache } from "../../domaine/types";
import { resumeVetements } from "../../domaine/vetements";
import { useAnnoncer } from "../annulation";
import { contexteReel } from "../contexte";
import { feteFee } from "../fee";
import { vibrer } from "../haptique";
import { soufflerPuis } from "../moteur/langage";
import { Icone } from "../Icone";
import type { DonneesModule } from "../modules";
import type { Page } from "../pages";
import { enLettres, EnteteEspace, Grille, LigneDite, Tuile } from "../pieces/Cartes";
import { CarteTael } from "../pieces/Tael";
import { noterUsage } from "../usage";

// Maison (Kora 0.1) : la page de cartes de l'espace. En laiton, ce qui presse chez nous (les
// poubelles à sortir, l'entretien dû) avec « C'est fait » ; le balcon et sa météo ; Tael ; Mitsu
// en ivoire ; l'entretien qui revient ; le carnet ; « Où est quoi » ; les vêtements.

export function EspaceMaison(props: { donnees: DonneesModule; depot: Depot; ouvrir: (p: Page) => void }) {
  const { donnees, depot } = props;
  const { aujourdhui, membreId } = donnees;
  const annoncer = useAnnoncer();
  const ouvrir = (onglet: string, ancre?: string) => {
    noterUsage("widget", "maison");
    props.ouvrir(ancre ? { nom: "module", id: "maison", onglet, ancre } : { nom: "module", id: "maison", onglet });
  };

  // ----- Ce qui presse -----
  const dechets = aSortirCeSoir(reglageDechets(donnees.maison), aujourdhui);
  const entretien = organiserEntretien(donnees.taches, aujourdhui);
  const du = entretien.find((l) => l.du) ?? null;
  const faire = async (t: Tache) => {
    vibrer();
    const apres = marquerFaite(t, membreId, aujourdhui, contexteReel);
    await depot.enregistrerTache(apres);
    feteFee();
    noterUsage("tache", t.id);
    annoncer(`« ${t.titre} » faite. Prochaine fois ${decrireEcheance(apres.echeance, aujourdhui)}.`, () => depot.enregistrerTache(t));
  };

  // ----- Le balcon -----
  const meteo = meteoDu(donnees.meteo, aujourdhui);
  const gestes = gestesDuJardin(donnees.zones, donnees.meteo, aujourdhui);
  const geste = gestes[0] ?? null;

  // ----- Mitsu -----
  const animal = donnees.animaux[0] ?? null;
  const mitsu = animal ? choseAFaire(animal, aujourdhui) : [];
  const poids = animal ? poidsDeReference(animal) : null;
  const portrait = animal ? [decrireAge(animal.naissance, aujourdhui), poids && `${poids.estime ? "≈ " : ""}${formaterPoids(poids.grammes)}`].filter(Boolean).join(", ") : "";

  // ----- Le reste -----
  const carnet = carnetDe(donnees.maison);
  const rangements = rangementsDe(donnees.maison);
  const objets = rangements.reduce((n, r) => n + r.objets.length, 0);
  const vetements = membreId ? resumeVetements(donnees.vetements, membreId, `${aujourdhui}T12:00:00.000Z`) : "";
  const majuscule = (t: string) => t.replace(/^./, (c) => c.toUpperCase());

  let i = 0;
  return (
    <main className="page espace maison">
      <EnteteEspace titre="Maison" sous={dechets.length ? phraseSortir(dechets) : du ? `${du.tache.titre}, ${du.quand}` : geste?.urgent ? geste.texte : "Entretien, jardin, Mitsu et vêtements"} />

      <Grille label="Maison">
        {dechets.length ? (
          <Tuile forte large i={i++} onClick={() => ouvrir("entretien", "dechets")} label={phraseSortir(dechets)}>
            <p className="etiq">Ce soir</p>
            <p className="titre-c">{phraseSortir(dechets)}</p>
            <p className="doux">Le camion passe demain matin.</p>
          </Tuile>
        ) : du ? (
          <Tuile forte large i={i++} role="group" label={`À faire : ${du.tache.titre}, ${du.quand}`}>
            <p className="etiq">À faire, {du.quand}</p>
            <p className="titre-c">{du.tache.titre}</p>
            {du.depuis && <p className="doux">{majuscule(du.depuis)}.</p>}
            <div className="actions-c">
              <button type="button" className="pilule" onClick={(e) => soufflerPuis(e.currentTarget.closest<HTMLElement>(".tuile"), () => void faire(du.tache))}>C'est fait</button>
              <button type="button" className="pilule" onClick={() => ouvrir("entretien")}>Tout l'entretien</button>
            </div>
          </Tuile>
        ) : (
          <Tuile forte large i={i++} onClick={() => ouvrir("entretien")} label="Rien ne presse à la maison">
            <p className="etiq">La maison</p>
            <p className="titre-c">{entretien.length ? "Rien ne presse cette semaine." : "Choisis ce qui revient pour la maison."}</p>
            {entretien[0] && <p className="doux">Prochain : {entretien[0].tache.titre}, {entretien[0].quand}.</p>}
          </Tuile>
        )}

        <Tuile i={i++} widget="jardin" onClick={() => ouvrir("jardin")} label={`Jardin : ${geste?.texte ?? "rien à faire"}`} className={geste?.urgent ? "presse" : undefined}>
          <p className="etiq"><Icone nom="feuille" taille={18} />Jardin</p>
          <div className="meteo-c">
            {meteo && <span className="deg">{Math.round(meteo.max)}°</span>}
            <p className="doux">{meteo ? `${decrireTemps(meteo.code)}, ${formaterTemperatures(meteo)}. ` : ""}{donnees.zones.length === 0 ? "Ajoute tes pots et tes bacs." : geste?.texte ?? "Rien à faire aujourd'hui."}</p>
          </div>
        </Tuile>

        <CarteTael />

        <Tuile contraste large i={i++} widget="mitsu" onClick={() => ouvrir("mitsu")} label={animal ? `${animal.nom} : ${mitsu[0]?.texte ?? portrait}` : "Mitsu : créer sa fiche"}>
          <p className="etiq"><Icone nom="chat" taille={18} />{animal?.nom ?? "Mitsu"}</p>
          <p className="titre-c">{animal ? (mitsu[0]?.texte ?? "Tout va bien.") : "Créer sa fiche."}</p>
          {animal && <p className="doux">{mitsu.length > 1 ? `${mitsu.length - 1} autre${mitsu.length > 2 ? "s" : ""} chose${mitsu.length > 2 ? "s" : ""} · ` : ""}{portrait}</p>}
        </Tuile>

        <Tuile large i={i++} widget="entretien" onClick={() => ouvrir("entretien")} label={`Entretien : ${entretien.filter((l) => l.du).length} cette semaine`}>
          <p className="etiq"><Icone nom="outil" taille={18} />Entretien</p>
          {entretien.length ? (
            <div className="lignes">
              {entretien.slice(0, 4).map((l) => (
                <LigneDite key={l.tache.id} texte={l.tache.titre} fin={l.quand} urgent={l.quand.startsWith("en retard")} />
              ))}
            </div>
          ) : (
            <p className="doux">Les gestes qui reviennent : filtres, draps, détartrage. Choisis-les ici.</p>
          )}
        </Tuile>

        <Tuile i={i++} touche="maison" onClick={() => ouvrir("entretien", "carnet")} label={`Carnet : ${carnet.length} ligne${carnet.length > 1 ? "s" : ""}`}>
          <p className="etiq"><Icone nom="dossier" taille={18} />Carnet</p>
          <p className={carnet.length === 0 ? "doux" : "phrase"}>{carnet.length === 0 ? "Concierge, gérance, compteurs : ce qu'on cherche toujours." : <><b>{carnet.length}</b> ligne{carnet.length > 1 ? "s" : ""} : {carnet.slice(0, 3).map((c) => c.titre).join(", ")}{carnet.length > 3 ? "…" : ""}</>}</p>
        </Tuile>

        <Tuile i={i++} touche="maison" onClick={() => ouvrir("entretien", "rangements")} label={`Où est quoi : ${objets} objets`}>
          <p className="etiq"><Icone nom="loupe" taille={18} />Où est quoi</p>
          <p className={rangements.length === 0 ? "doux" : "phrase"}>{rangements.length === 0 ? "« Cave : perceuse, skis » et Kora s'en souvient." : <><b>{enLettres(objets).replace(/^./, (c) => c.toUpperCase())}</b> objet{objets > 1 ? "s" : ""} dans {rangements.length} lieu{rangements.length > 1 ? "x" : ""}.</>}</p>
        </Tuile>

        <Tuile large i={i++} touche="vetements" onClick={() => ouvrir("vetements")} label={`Vêtements : ${vetements}`}>
          <p className="etiq"><Icone nom="coeur" taille={18} />Vêtements</p>
          <p className={vetements ? "phrase" : "doux"}>{vetements || "Les tailles et les envies de chacun, partagées."}</p>
        </Tuile>
      </Grille>
    </main>
  );
}
