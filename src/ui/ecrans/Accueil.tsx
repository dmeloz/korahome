import { compterAPrendre } from "../../domaine/listes";
import type { Element, Foyer, Liste } from "../../domaine/types";

function salutation(heure: number): string {
  if (heure < 5) return "Bonne nuit";
  if (heure < 18) return "Bonjour";
  return "Bonsoir";
}

export function Accueil(props: {
  foyer: Foyer;
  membreId: string | null;
  listes: Liste[];
  elements: Element[];
  ouvrirListe: (id: string) => void;
}) {
  const moi = props.foyer.membres.find((m) => m.id === props.membreId);
  const courses = props.listes.find((l) => l.type === "courses");
  const restant = courses ? compterAPrendre(courses, props.elements) : 0;
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
      <div className="carte tuile tuile-inactive">
        <span className="tuile-icone" aria-hidden>✅</span>
        <span>
          <strong>Tâches de la maison</strong>
          <span className="discret">Arrive bientôt</span>
        </span>
      </div>
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
