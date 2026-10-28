import type { ChoseDuJour } from "../../domaine/aujourdhui";
import { basculerCoeur } from "../../domaine/bandeau";
import { compterCeSoir, type Hub } from "../../domaine/hub";
import { basculerCoche } from "../../domaine/listes";
import type { WidgetId } from "../../domaine/tableauDeBord";
import type { Element } from "../../domaine/types";
import type { Depot } from "../../donnees/depot";
import { contexteReel } from "../contexte";
import { vibrer } from "../haptique";
import { sauver } from "../sauver";

// Le hub Kora sur iPad (0.0.95) : six cartes « bento » sur la grille large, à la place des
// chiffres, de « Ce soir » et des piles de l'iPhone. Il se consulte à deux, debout, et on coche
// d'un doigt : une ligne cochée ici l'est sur les deux iPhone. Pas de réglages ni de Budget.

export function HubIpad(props: {
  hub: Hub;
  depot: Depot;
  membreId: string | null;
  /** Qui fait la chose : « vous deux », « Melo », ou rien. */
  qui: (c: ChoseDuJour) => string | null;
  cocher: (c: ChoseDuJour) => void;
  toucher: (c: ChoseDuJour) => void;
  ouvrir: (id: WidgetId) => void;
  ouvrirMots: () => void;
}) {
  const { hub, depot } = props;

  async function cocherCourse(e: Element) {
    vibrer();
    await depot.enregistrerElement({ ...basculerCoche(e, contexteReel), cochePar: props.membreId });
  }
  function coeur() {
    if (!hub.mot || !props.membreId) return;
    vibrer();
    sauver(depot.enregistrerCouple(basculerCoeur(hub.mot.mot, props.membreId)));
  }

  return (
    <section className="hub grille-large" aria-label="Le hub de la maison">
      <section className="hub-carte hub-ce-soir" aria-label="Ce soir">
        <header className="hub-entete">
          <h2>Ce soir</h2>
          <span className="discret">{compterCeSoir(hub.ceSoir)}</span>
        </header>
        {hub.ceSoir.length === 0 && <p className="hub-vide">Rien de prévu, rien ne presse.</p>}
        <ul className="hub-lignes">
          {hub.ceSoir.map((c) => {
            const qui = props.qui(c);
            return (
              <li key={c.cle} className={`hub-ligne${c.etat === "urgent" ? " urgent" : ""}`}>
                {c.tacheId ? (
                  <button type="button" className="case" aria-label={`Marquer « ${c.texte} » comme fait`} onClick={() => props.cocher(c)} />
                ) : (
                  <span className="case vide" aria-hidden />
                )}
                <button type="button" className="hub-ligne-texte" onClick={() => props.toucher(c)}>
                  <span className="ligne-texte">{c.texte}</span>
                  <span className="tache-details">{c.quand}</span>
                </button>
                {qui && <span className="hub-qui">{qui}</span>}
              </li>
            );
          })}
        </ul>
        <p className="hub-pied">Une ligne cochée ici est cochée sur les deux iPhone.</p>
      </section>

      <button type="button" className="hub-carte hub-menu" onClick={() => props.ouvrir("chef")}>
        <header className="hub-entete">
          <h2>Au menu</h2>
          <span className="discret">{hub.menu ? "Le Chef" : ""}</span>
        </header>
        {hub.menu ? <p className="hub-grand">{hub.menu}</p> : <p className="hub-vide">Pas de menu ce soir. Demande une idée à ta fée.</p>}
      </button>

      <section className="hub-carte hub-courses" aria-label="Les courses">
        <header className="hub-entete">
          <h2>Courses</h2>
          <span className="hub-chiffre">{hub.courses.elements.length + hub.courses.reste || ""}</span>
        </header>
        {hub.courses.elements.length === 0 && <p className="hub-vide">Rien à acheter.</p>}
        <ul className="hub-lignes serrees">
          {hub.courses.elements.map((e) => (
            <li key={e.id} className="hub-ligne">
              <button type="button" className={`case${e.source === "chef" ? " chef" : ""}`} aria-label={`Cocher ${e.texte}`} onClick={() => sauver(cocherCourse(e))} />
              <span className="ligne-texte">{e.texte}</span>
              {e.source === "chef" && <span className="etiquette-chef">Chef</span>}
            </li>
          ))}
        </ul>
        <button type="button" className="lien hub-lien" onClick={() => props.ouvrir("courses")}>
          {hub.courses.reste ? `Toute la liste (${hub.courses.reste} de plus)` : "Toute la liste"}
        </button>
      </section>

      <button type="button" className="hub-carte hub-demain" onClick={() => props.ouvrir("agenda")}>
        <header className="hub-entete">
          <h2>Demain</h2>
        </header>
        {hub.demain.length === 0 && <p className="hub-vide">Rien dans l'agenda demain.</p>}
        <ul className="hub-lignes serrees">
          {hub.demain.map((l, i) => (
            <li key={i} className="hub-ligne">
              <span className={`hub-heure${l.presse ? " presse" : ""}`}>{l.quand}</span>
              <span className="ligne-texte">{l.texte}</span>
            </li>
          ))}
        </ul>
      </button>

      <section className={`hub-carte hub-mot${hub.mot ? " avec-mot" : ""}${hub.balcon ? "" : " seul"}`} aria-label="Un mot de l'autre">
        <header className="hub-entete">
          <h2 className={hub.mot ? "laiton" : undefined}>{hub.mot ? hub.mot.titre : "Nos mots"}</h2>
        </header>
        {hub.mot ? <p className="hub-grand leger">« {hub.mot.mot.texte} »</p> : <p className="hub-vide">Pas de mot aujourd'hui. Écris-en un à l'autre.</p>}
        <div className="hub-actions">
          {hub.mot && props.membreId && (
            <button type="button" className={hub.mot.coeurDonne ? "bouton-doux" : "bouton-principal"} onClick={coeur} aria-pressed={hub.mot.coeurDonne}>
              {hub.mot.coeurDonne ? "Cœur envoyé" : "Un cœur"}
            </button>
          )}
          <button type="button" className="bouton-doux" onClick={props.ouvrirMots}>
            {hub.mot ? "Répondre" : "Écrire un mot"}
          </button>
        </div>
      </section>

      {hub.balcon && (
        <button type="button" className="hub-carte hub-balcon" onClick={() => props.ouvrir("jardin")}>
          <header className="hub-entete">
            <h2>Balcon</h2>
            <span className="discret">Open-Meteo</span>
          </header>
          <div className="hub-meteo">
            {hub.balcon.nuit && <span className="hub-chiffre grand">{hub.balcon.nuit}</span>}
            <span className="discret">{[hub.balcon.nuit ? "cette nuit" : null, hub.balcon.demain].filter(Boolean).join(" · ") || "Météo en attente"}</span>
          </div>
          <p className={`hub-geste${hub.balcon.urgent ? " urgent" : ""}`}>{hub.balcon.geste}</p>
        </button>
      )}
    </section>
  );
}
