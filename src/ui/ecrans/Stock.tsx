import { useState, type FormEvent } from "react";
import { ErreurValidation } from "../../domaine/foyer";
import { nouvelElement, trouverDoublon } from "../../domaine/listes";
import {
  LIEUX,
  ORDRE_LIEUX,
  datesRapides,
  decrirePeremption,
  deplacer,
  etatProduit,
  nouveauProduit,
  organiserStock,
  type Lieu,
  type Produit,
} from "../../domaine/stock";
import type { Element, Jour, Liste } from "../../domaine/types";
import type { Depot } from "../../donnees/depot";
import { useAnnoncer } from "../annulation";
import { contexteReel } from "../contexte";
import { Glissable } from "../Glissable";

// Frigo, congélateur et placard : ce qu'il y a à la maison, ce qui arrive à sa
// date en tête. Ce qui est fini part d'un toucher sur la liste de courses.

export function Stock(props: { depot: Depot; membreId: string | null; produits: Produit[]; listes: Liste[]; elements: Element[]; aujourdhui: Jour }) {
  const { aujourdhui } = props;
  const [filtre, setFiltre] = useState<Lieu | "tous">("tous");
  const [saisie, setSaisie] = useState("");
  const [lieu, setLieu] = useState<Lieu>("frigo");
  const [peremption, setPeremption] = useState<Jour | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const annoncer = useAnnoncer();
  const courses = props.listes.find((l) => l.type === "courses");
  const groupes = organiserStock(props.produits, aujourdhui, filtre);

  async function ajouter(e: FormEvent) {
    e.preventDefault();
    try {
      await props.depot.enregistrerProduit(nouveauProduit({ texte: saisie, lieu, peremption }, props.membreId, contexteReel));
      setSaisie("");
      setPeremption(null);
      setMessage(null);
    } catch (err) {
      if (err instanceof ErreurValidation) setMessage(err.message);
      else throw err;
    }
  }

  async function supprimer(p: Produit) {
    await props.depot.supprimerProduit(p.id);
    setOuvert(null);
    annoncer(`« ${p.nom} » retiré.`, () => props.depot.enregistrerProduit(p));
  }

  /** Fini : il quitte le stock et rejoint la liste de courses, sauf s'il y est déjà. */
  async function aRacheter(p: Produit) {
    if (!courses) return;
    const siens = props.elements.filter((e) => e.listeId === courses.id);
    const deja = trouverDoublon(siens, p.nom);
    const element = deja ? null : nouvelElement(courses, p.nom, props.membreId, contexteReel);
    if (element) await props.depot.enregistrerElement(element);
    await props.depot.supprimerProduit(p.id);
    setOuvert(null);
    annoncer(deja ? `« ${p.nom} » est déjà sur la liste de courses.` : `« ${p.nom} » ajouté aux courses.`, async () => {
      if (element) await props.depot.supprimerElements([element.id]);
      await props.depot.enregistrerProduit(p);
    });
  }

  function ligne(p: Produit, montrerLieu: boolean) {
    const etat = etatProduit(p, aujourdhui);
    const date = decrirePeremption(p, aujourdhui);
    const details = [montrerLieu ? LIEUX[p.lieu] : null, p.quantite, date].filter(Boolean);
    const estOuvert = ouvert === p.id;
    return (
      <li key={p.id}>
        <Glissable onSupprimer={() => void supprimer(p)} libelle="Retirer">
          <button className="ligne produit" onClick={() => setOuvert(estOuvert ? null : p.id)} aria-expanded={estOuvert}>
            <span className={`point-produit etat-${etat}`} aria-hidden />
            <span className="ligne-texte produit-texte">
              <span>{p.nom}</span>
              {details.length > 0 && (
                <span className={`tache-details${etat === "perime" || etat === "aujourdhui" ? " retard" : ""}`}>{details.join(" · ")}</span>
              )}
            </span>
          </button>
        </Glissable>
        {estOuvert && (
          <div className="tache-actions produit-actions">
            {courses && <button className="lien" onClick={() => void aRacheter(p)}>Fini, à racheter</button>}
            {ORDRE_LIEUX.filter((l) => l !== p.lieu).map((l) => (
              <button key={l} className="lien" onClick={() => void props.depot.enregistrerProduit(deplacer(p, l))}>
                Vers {LIEUX[l].toLowerCase()}
              </button>
            ))}
            <label className="lien date-produit">
              Date
              <input
                type="date"
                value={p.peremption ?? ""}
                onChange={(e) => void props.depot.enregistrerProduit({ ...p, peremption: e.target.value || null })}
              />
            </label>
          </div>
        )}
      </li>
    );
  }

  return (
    <main>
      <h1>Frigo et placards</h1>

      <form onSubmit={ajouter} className="ajout-tache">
        <div className="ajout">
          <input
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            placeholder="Ajouter (ex. 4 yaourts)"
            enterKeyHint="done"
            aria-label="Nouveau produit"
          />
          <button type="submit" disabled={!saisie.trim()} aria-label="Ajouter">+</button>
        </div>
        {saisie.trim() && (
          <div className="options-tache">
            <div className="puces" role="group" aria-label="Où">
              {ORDRE_LIEUX.map((l) => (
                <button type="button" key={l} className={`puce${l === lieu ? " active" : ""}`} aria-pressed={l === lieu} onClick={() => setLieu(l)}>
                  {LIEUX[l]}
                </button>
              ))}
            </div>
            <div className="puces" role="group" aria-label="À consommer avant">
              <button type="button" className={`puce${peremption === null ? " active" : ""}`} aria-pressed={peremption === null} onClick={() => setPeremption(null)}>
                Sans date
              </button>
              {datesRapides(aujourdhui).map((d) => (
                <button
                  type="button"
                  key={d.libelle}
                  className={`puce${peremption === d.jour ? " active" : ""}`}
                  aria-pressed={peremption === d.jour}
                  onClick={() => setPeremption(d.jour)}
                >
                  {d.libelle}
                </button>
              ))}
            </div>
            <label className="date-tache">
              À consommer avant le
              <input type="date" value={peremption ?? ""} min={aujourdhui} onChange={(e) => setPeremption(e.target.value || null)} />
            </label>
          </div>
        )}
      </form>
      {message && <p className="erreur" role="status">{message}</p>}

      {props.produits.length > 0 && (
        <div className="segments" role="group" aria-label="Afficher">
          {(["tous", ...ORDRE_LIEUX] as const).map((f) => (
            <button key={f} className={f === filtre ? "actif" : ""} aria-pressed={f === filtre} onClick={() => setFiltre(f)}>
              {f === "tous" ? "Tout" : LIEUX[f]}
            </button>
          ))}
        </div>
      )}

      {props.produits.length === 0 && (
        <div className="carte bientot">
          <p>Le frigo est vide pour l'instant.</p>
          <p className="discret">
            Ajoute ce qu'il y a au frigo, au congélateur et au placard, avec leur date : ce qui arrive à sa date remonte en
            haut, et le rappel du matin te le dit.
          </p>
        </div>
      )}
      {props.produits.length > 0 && groupes.length === 0 && <p className="vide">Rien ici.</p>}

      {groupes.map((g) => (
        <section key={g.cle}>
          <h2 className={`rayon${g.cle === "aConsommer" ? " retard" : ""}`}>{g.titre}</h2>
          <ul className="carte groupe">{g.produits.map((p) => ligne(p, g.cle === "aConsommer" && filtre === "tous"))}</ul>
        </section>
      ))}

      {props.produits.length > 0 && <p className="discret indice">Glisse un produit vers la gauche pour le retirer.</p>}
    </main>
  );
}
