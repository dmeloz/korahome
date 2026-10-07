import { compterAPrendre } from "../../domaine/listes";
import { compterDues } from "../../domaine/taches";
import type { Element, Foyer, Liste, Tache } from "../../domaine/types";
import { aujourdhuiLocal } from "../contexte";

function salutation(heure: number): string {
  if (heure < 5) return "Bonne nuit";
  if (heure < 18) return "Bonjour";
  return "Bonsoir";
}

function resumeTaches(dues: { aujourdhui: number; enRetard: number }, total: number): string {
  if (total === 0) return "Ajouter les tâches de la maison";
  const morceaux = [];
  if (dues.aujourdhui > 0) morceaux.push(`${dues.aujourdhui} pour aujourd'hui`);
  if (dues.enRetard > 0) morceaux.push(`${dues.enRetard} en retard`);
  return morceaux.length ? morceaux.join(", ") : "Rien à faire aujourd'hui";
}

export function Accueil(props: {
  foyer: Foyer;
  membreId: string | null;
  listes: Liste[];
  elements: Element[];
  taches: Tache[];
  ouvrirListe: (id: string) => void;
  ouvrirTaches: () => void;
}) {
  const moi = props.foyer.membres.find((m) => m.id === props.membreId);
  const courses = props.listes.find((l) => l.type === "courses");
  const restant = courses ? compterAPrendre(courses, props.elements) : 0;
  const dues = compterDues(props.taches, aujourdhuiLocal());
  const date = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <main>
      <p className="surtitre">{date}</p>
      <h1>
        {salutation(new Date().getHours())}
        {moi ? ` ${moi.prenom}` : ""}
      </h1>
      {courses && (
        <button className="carte tuile" onClick={() => props.ouvrirListe(courses.id)}>
          <span className="tuile-icone" aria-hidden>{courses.icone}</span>
          <span>
            <strong>{courses.nom}</strong>
            <span className="discret">
              {restant === 0 ? "Rien à acheter" : `${restant} article${restant > 1 ? "s" : ""} à acheter`}
            </span>
          </span>
          <span className="chevron" aria-hidden>›</span>
        </button>
      )}
      <button className="carte tuile" onClick={props.ouvrirTaches}>
        <span className="tuile-icone" aria-hidden>✅</span>
        <span>
          <strong>Tâches de la maison</strong>
          <span className="discret">{resumeTaches(dues, props.taches.length)}</span>
        </span>
        <span className="chevron" aria-hidden>›</span>
      </button>
      <div className="carte tuile tuile-inactive">
        <span className="tuile-icone" aria-hidden>🗓️</span>
        <span>
          <strong>Agenda</strong>
          <span className="discret">Arrive bientôt</span>
        </span>
      </div>
    </main>
  );
}
