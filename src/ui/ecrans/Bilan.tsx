import { useEffect, useState } from "react";
import { bilanDeLaSemaine, type Apprentissage } from "../../domaine/apprentissage";
import { useAnnoncer } from "../annulation";
import { calculerApprentissages, deciderApprentissage, type ServicesApprentissage } from "../apprendre";
import { vibrer } from "../haptique";
import { Icone } from "../Icone";
import { noterBilanVu, useApprentissageLocal } from "../usage";
import { nomFee } from "../fee";
import { Page } from "../pieces";

// Le bilan du dimanche : deux ou trois choses que Kora a remarquées dans la semaine. On les
// garde ou on les refuse d'un geste ; rien n'est retenu sans accord.
export function Bilan(props: ServicesApprentissage & { ouvrirAppris: () => void }) {
  useApprentissageLocal();
  const annoncer = useAnnoncer();
  // Le bilan est figé à l'ouverture : une carte décidée reste visible, avec ce qui a été choisi.
  const [cartes] = useState<Apprentissage[]>(() => bilanDeLaSemaine(calculerApprentissages(props.donnees)));
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    noterBilanVu();
  }, []);

  async function decider(a: Apprentissage, garde: boolean) {
    vibrer();
    const defaire = await deciderApprentissage(a, garde, props);
    setDecisions((d) => ({ ...d, [a.cle]: garde }));
    annoncer(garde ? "Kora l'a retenu." : "Kora ne le proposera plus.", async () => {
      await defaire();
      setDecisions(({ [a.cle]: _, ...reste }) => reste);
    });
  }

  return (
    <Page titre="Bilan de la semaine" sousTitre="Ce que Kora a remarqué" className="bilan avec-cadre">
      <p className="discret">Rien n'est retenu sans toi. Ce qui vient du foyer sert aussi à {nomFee()} et au Chef ; ce qui ne concerne que toi reste sur ce téléphone.</p>

      {cartes.length === 0 ? (
        <div className="carte bilan-vide">
          <span className="pictogramme"><Icone nom="appris" taille={20} /></span>
          <p>Kora observe encore. Plus vous utilisez l'app, plus le bilan du dimanche aura à dire.</p>
        </div>
      ) : (
        <ol className="bilan-cartes">
          {cartes.map((a, i) => {
            const decide = decisions[a.cle];
            return (
              <li key={a.cle} className={`carte bilan-carte${decide === undefined ? "" : " decidee"}`} style={{ animationDelay: `${i * 0.08}s` }}>
                <span className={`bilan-portee${a.portee === "perso" ? " perso" : ""}`}>{a.portee === "foyer" ? "Le foyer" : "Rien qu'à toi"}</span>
                <p className="bilan-texte">{a.texte}</p>
                {decide === undefined ? (
                  <div className="bilan-choix">
                    <button className="bouton-principal" onClick={() => void decider(a, true)}>{a.oui}</button>
                    <button className="bouton-secondaire" onClick={() => void decider(a, false)}>Non merci</button>
                  </div>
                ) : (
                  <p className="bilan-decision">
                    <Icone nom={decide ? "coche" : "fermer"} taille={16} />
                    {decide ? "Retenu" : "Écarté, il ne reviendra pas"}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <button className="lien bilan-lien" onClick={props.ouvrirAppris}>Tout ce que Kora sait de nous</button>
    </Page>
  );
}
