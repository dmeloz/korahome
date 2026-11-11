import type { Depot } from "../../donnees/depot";
import { menuDeLaSemaine, prochainPassage, reglageChef } from "../../domaine/chef";
import { enDirect, noterCocheur } from "../../domaine/ecranAccueil";
import { basculerCoche, compterAPrendre, listesVisibles } from "../../domaine/listes";
import { recetteDuSoir, recettesDe, soirsPrevus } from "../../domaine/recettes";
import { nomDuSoirPasse, repasRecents } from "../../domaine/repas";
import { decrirePeremption, resumeStock } from "../../domaine/stock";
import type { Element } from "../../domaine/types";
import { contexteReel } from "../contexte";
import { feteFee } from "../fee";
import { vibrer } from "../haptique";
import { Icone } from "../Icone";
import type { DonneesModule } from "../modules";
import { sceller } from "../moteur/langage";
import type { Page } from "../pages";
import { enLettres, EnteteEspace, Grille, LigneCoche, Semaine, Tuile } from "../pieces/Cartes";
import { CarteTael } from "../pieces/Tael";
import { sauver } from "../sauver";
import { ecrireAFee } from "../tael";
import { noterUsage } from "../usage";

// Cuisine (Kora 0.1) : la page de cartes de l'espace. Les courses à cocher d'ici, Tael, ce soir
// en héros, la semaine du Chef, le frigo, les recettes, ce qu'on a mangé hier en ivoire, les
// autres listes. Chaque carte mène à sa page (Courses, Menus, Recettes, Frigo).

/** Combien d'articles la carte des courses montre. */
const COURSES_SUR_LA_CARTE = 5;

export function EspaceCuisine(props: { donnees: DonneesModule; depot: Depot; ouvrir: (p: Page) => void }) {
  const { donnees, depot } = props;
  const { aujourdhui, membreId } = donnees;
  const maintenant = new Date();
  const ouvrir = (onglet: string) => {
    noterUsage("widget", "chef");
    props.ouvrir({ nom: "module", id: "chef", onglet });
  };

  // ----- Courses -----
  const liste = donnees.listes.find((l) => l.type === "courses") ?? null;
  const articles = liste ? donnees.elements.filter((e) => e.listeId === liste.id) : [];
  const aPrendre = articles.filter((e) => !e.coche).sort((a, b) => a.creeLe.localeCompare(b.creeLe));
  const montres = aPrendre.slice(0, COURSES_SUR_LA_CARTE);
  const reste = aPrendre.length - montres.length;
  const direct = enDirect({ ...donnees, membreId }, maintenant.toISOString());
  const cocher = (e: Element) => {
    vibrer();
    const apres = noterCocheur(e, basculerCoche(e, contexteReel), membreId);
    sauver(depot.enregistrerElement(apres));
    if (!e.coche) {
      feteFee();
      if (aPrendre.length === 1) sceller(document.querySelector(".page-dessus .grille"));
    }
  };

  // ----- Le Chef -----
  const recettes = recettesDe(donnees.menus);
  const menu = menuDeLaSemaine(donnees.menus, aujourdhui);
  const ceSoir = recetteDuSoir(recettes, aujourdhui);
  const passage = prochainPassage(reglageChef(donnees.menus), maintenant);
  const prevus = soirsPrevus(recettes, aujourdhui);
  const pleins = new Set(prevus.map((s) => s.jour));
  const prochainRepas = menu?.repas.find((r) => !r.valideLe) ?? menu?.repas[0];
  const titreCeSoir = ceSoir?.titre ?? prochainRepas?.titre ?? null;

  // ----- Frigo, recettes, journal, listes -----
  const frigo = resumeStock(donnees.produits, aujourdhui);
  const repas = repasRecents(donnees.menus, aujourdhui);
  const dernierRepas = repas.find((r) => r.jour < aujourdhui) ?? repas[0];
  const autresListes = listesVisibles(donnees.listes, membreId).filter((l) => l.type !== "courses");
  const aFaireAilleurs = autresListes.reduce((n, l) => n + compterAPrendre(l, donnees.elements), 0);

  let i = 0;
  return (
    <main className="page espace cuisine">
      <EnteteEspace titre="Cuisine" sous={aPrendre.length ? `${enLettres(aPrendre.length).replace(/^./, (c) => c.toUpperCase())} chose${aPrendre.length > 1 ? "s" : ""} à prendre` : titreCeSoir ? `Ce soir : ${titreCeSoir}` : "Courses, menus, recettes et frigo"} />

      <Grille label="Cuisine">
        <Tuile large i={i++} touche="elements" role="group" label={`Courses : ${aPrendre.length} à prendre`} className="courses-c">
          <p className="etiq"><Icone nom="panier" taille={18} />Courses{direct && <b className="navi direct" style={{ marginLeft: "auto" }}>{direct.qui} coche en direct</b>}</p>
          {montres.length ? (
            <div className="lignes">
              {montres.map((e) => (
                <LigneCoche key={e.id} coche={e.coche} texte={e.texte} fin={e.quantite ?? (e.source === "chef" ? "Chef" : e.source === "reserve" ? "Réserve" : null)} onClick={() => cocher(e)} />
              ))}
            </div>
          ) : (
            <p className="phrase">{liste ? "Rien à acheter. Dis-moi ce qui manque." : "Pas encore de liste de courses."}</p>
          )}
          <div className="actions-c">
            <button type="button" className="pilule fee" onClick={ecrireAFee}>Ajouter</button>
            <button type="button" className="pilule" onClick={() => ouvrir("courses")}>{reste > 0 ? `Tout voir, ${reste} de plus` : "Tout voir"}</button>
          </div>
        </Tuile>

        <CarteTael />

        <Tuile className="heros" large i={i++} widget="chef" onClick={() => ouvrir("semaine")} label={`Ce soir : ${titreCeSoir ?? "rien de prévu"}`}>
          <div className="heros-haut" aria-hidden />
          <div className="heros-corps">
            <div>
              <p className="etiq">Ce soir</p>
              <p className="titre-c">{titreCeSoir ?? (passage ? `Le Chef passe ${passage}.` : "Rien de prévu. Lance le Chef.")}</p>
              {ceSoir?.ingredients.length ? <p className="doux">{ceSoir.ingredients.slice(0, 3).map((x) => x.nom).join(", ")}</p> : prochainRepas?.description ? <p className="doux">{prochainRepas.description}</p> : null}
            </div>
          </div>
        </Tuile>

        <Tuile large i={i++} onClick={() => ouvrir("semaine")} label={`Menus de la semaine : ${prevus.length} soir${prevus.length > 1 ? "s" : ""} prévu${prevus.length > 1 ? "s" : ""}`}>
          <p className="etiq"><Icone nom="toque" taille={18} />Menus de la semaine{passage && <b className="pastille-k" style={{ marginLeft: "auto" }}>Chef {passage}</b>}</p>
          <Semaine aujourdhui={aujourdhui} pleins={pleins} />
          <p className="doux">{prevus.length ? `${enLettres(prevus.length).replace(/^./, (c) => c.toUpperCase())} soir${prevus.length > 1 ? "s" : ""} prévu${prevus.length > 1 ? "s" : ""}.` : menu ? `${menu.repas.length} repas proposés par le Chef, à valider.` : "Aucun soir prévu."}</p>
        </Tuile>

        <Tuile i={i++} widget="stock" onClick={() => ouvrir("frigo")} label={`Frigo et placards : ${frigo.aConsommer.length} à consommer bientôt`} className={frigo.urgent ? "presse" : undefined}>
          <p className="etiq"><Icone nom="frigo" taille={18} />Frigo et placards</p>
          <p className={donnees.produits.length === 0 ? "doux" : "phrase"}>
            {donnees.produits.length === 0 ? "Note ce qu'il y a au frigo." : frigo.aConsommer.length === 0 ? `${enLettres(donnees.produits.length).replace(/^./, (c) => c.toUpperCase())} produits, rien ne presse.` : <><b>{enLettres(frigo.aConsommer.length).replace(/^./, (c) => c.toUpperCase())}</b> à consommer : {frigo.aConsommer[0].nom}{frigo.aConsommer[0].peremption ? `, ${decrirePeremption(frigo.aConsommer[0], aujourdhui)}` : ""}.</>}
          </p>
        </Tuile>

        <Tuile i={i++} onClick={() => ouvrir("recettes")} label={`Nos recettes : ${recettes.length}`}>
          <p className="etiq"><Icone nom="note" taille={18} />Nos recettes</p>
          <p className={recettes.length === 0 ? "doux" : "phrase"}>{recettes.length === 0 ? "Le Chef les remplit soir après soir." : <><b>{recettes.length}</b> recette{recettes.length > 1 ? "s" : ""} du foyer{ceSoir ? `, ${ceSoir.titre} ce soir` : ""}.</>}</p>
        </Tuile>

        <Tuile contraste large i={i++} onClick={() => ouvrir("semaine")} label="Ce soir on a mangé">
          <p className="etiq">Ce qu'on a mangé</p>
          <p className="titre-c">{dernierRepas ? `${nomDuSoirPasse(dernierRepas.jour, aujourdhui).replace(/^./, (c) => c.toUpperCase())} : ${dernierRepas.titre}` : "Dis-moi « hier soir raclette »."}</p>
          {repas.length > 1 && <p className="doux">{repas.filter((r) => r !== dernierRepas).slice(0, 3).map((r) => r.titre).join(", ")}</p>}
        </Tuile>

        <Tuile large i={i++} widget="listes" onClick={() => ouvrir("listes")} label={`Autres listes : ${autresListes.length}`}>
          <p className="etiq"><Icone nom="liste" taille={18} />Autres listes</p>
          <p className={autresListes.length === 0 ? "doux" : "phrase"}>
            {autresListes.length === 0 ? "Une liste pour autre chose que les courses : vacances, cadeaux, bricolage." : <>{autresListes.slice(0, 3).map((l) => l.nom).join(", ")}{autresListes.length > 3 ? "…" : ""}{aFaireAilleurs ? ` · ${aFaireAilleurs} à faire` : ""}.</>}
          </p>
        </Tuile>
      </Grille>
    </main>
  );
}
