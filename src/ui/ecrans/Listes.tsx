import type { ReactNode } from "react";
import { compterAPrendre, nouvelleListe } from "../../domaine/listes";
import type { Liste } from "../../domaine/types";
import { useAnnoncer } from "../annulation";
import { contexteReel } from "../contexte";
import { Glissable } from "../Glissable";
import { Icone } from "../Icone";
import type { PropsPage } from "../modules";
import { Onglets, Page, useGestionnaireBarre } from "../pieces";
import { DetailListe } from "./DetailListe";

// Les courses et les autres listes, sur une seule page : l'onglet « Courses » montre la liste
// du foyer, l'onglet « Autres listes » les cadeaux, le bricolage… Le widget Listes ouvre
// directement le second onglet.

export function Courses(p: PropsPage) {
  const courses = p.listes.find((l) => l.type === "courses");
  const autres = p.listes.filter((l) => l.type !== "courses");
  const onglet = p.onglet === "listes" || !courses ? "listes" : "courses";
  const onglets = (
    <Onglets
      libelle="Listes"
      onglets={[
        { id: "courses", libelle: "Courses", compte: courses ? compterAPrendre(courses, p.elements) : 0 },
        { id: "listes", libelle: "Autres listes", compte: autres.length },
      ]}
      actif={onglet}
      changer={(id) => p.changerOnglet(id === "listes" ? "listes" : undefined)}
    />
  );
  if (onglet === "courses" && courses) {
    return <DetailListe depot={p.depot} foyer={p.foyer} membreId={p.membreId} liste={courses} elements={p.elements} catalogue={p.catalogue} avant={onglets} />;
  }
  return <AutresListes {...p} listes={autres} avant={onglets} />;
}

function AutresListes(props: PropsPage & { avant: ReactNode }) {
  const annoncer = useAnnoncer();

  async function supprimer(l: Liste) {
    const siens = props.elements.filter((e) => e.listeId === l.id);
    await props.depot.supprimerListe(l.id);
    annoncer(`Liste « ${l.nom} » supprimée.`, async () => {
      await props.depot.enregistrerListe(l);
      for (const e of siens) await props.depot.enregistrerElement(e);
    });
  }

  // Sur cet onglet, la fée crée une liste du nom dit ; une question part dans la conversation.
  useGestionnaireBarre("module:courses:listes", async (texte) => {
    const nom = texte.trim().replace(/^(nouvelle |une )?liste\s*(de |des |du |pour )?/i, "");
    if (!nom || nom.endsWith("?")) return false;
    const liste = nouvelleListe(nom.charAt(0).toUpperCase() + nom.slice(1), "📝", "simple", contexteReel);
    await props.depot.enregistrerListe(liste);
    annoncer(`Liste « ${liste.nom} » créée.`, () => props.depot.supprimerListe(liste.id));
    return true;
  });

  return (
    <Page titre="Listes" sousTitre="Cadeaux, bricolage, vacances…" aide={{ cle: "listes", texte: "Dis le nom d'une nouvelle liste à ta fée (cadeaux, bricolage, vacances). Glisse une liste vers la gauche pour la retirer." }}>
      {props.avant}
      {props.listes.length === 0 ? (
        <p className="vide">Aucune autre liste. Dis à ta fée « liste cadeaux de Noël ».</p>
      ) : (
        <ul className="carte groupe">
          {props.listes.map((l) => {
            const n = compterAPrendre(l, props.elements);
            return (
              <li key={l.id}>
                <Glissable onSupprimer={() => void supprimer(l)}>
                  <button className="ligne" onClick={() => props.ouvrirListe(l.id)}>
                    <span className="pictogramme"><Icone nom="liste" taille={20} /></span>
                    <span className="ligne-texte">{l.nom}</span>
                    {n > 0 && <span className="pastille">{n}</span>}
                    <span className="chevron"><Icone nom="suivant" taille={18} /></span>
                  </button>
                </Glissable>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
