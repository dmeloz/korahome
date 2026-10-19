import { accepterEquilibre, equilibreVisible } from "../../domaine/apprentissage";
import { souvenirsRetenus, type Souvenir } from "../../domaine/memoire";
import type { Depot } from "../../donnees/depot";
import { useAnnoncer } from "../annulation";
import { Glissable } from "../Glissable";
import { Icone } from "../Icone";
import type { DonneesModule } from "../modules";
import {
  changerAdaptations,
  effacerUsages,
  lireAdaptations,
  lireDecisionsPerso,
  oublierDecisionPerso,
  useApprentissageLocal,
  type Adaptations,
} from "../usage";
import { nomFee } from "../fee";

const estDuChef = (s: Souvenir) => s.cle?.startsWith("chef:") ?? false;

function Interrupteur(props: { titre: string; detail: string; actif: boolean; changer: (actif: boolean) => void }) {
  return (
    <li>
      <button className="ligne appris-interrupteur" role="switch" aria-checked={props.actif} onClick={() => props.changer(!props.actif)}>
        <span className="ligne-texte">
          {props.titre}
          <span className="bulle-note">{props.detail}</span>
        </span>
        <span className={`interrupteur${props.actif ? " actif" : ""}`} aria-hidden />
      </button>
    </li>
  );
}

// « Ce que Kora sait de nous » : tout ce qui a été appris, d'où ça vient, et de quoi le
// corriger ou l'oublier. Le foyer d'un côté (partagé), ce qui ne concerne que toi de l'autre.
export function CeQueKoraSait(props: { donnees: DonneesModule; depot: Depot; ouvrirBilan: () => void; ouvrirMemoire: () => void }) {
  useApprentissageLocal();
  const annoncer = useAnnoncer();
  const { foyer, membreId, souvenirs, depot } = { ...props.donnees, depot: props.depot };
  const adaptations = lireAdaptations();
  const appris = souvenirsRetenus(souvenirs).filter((s) => s.source === "bilan" && !estDuChef(s)).sort((a, b) => b.creeLe.localeCompare(a.creeLe));
  const gouts = souvenirsRetenus(souvenirs).filter(estDuChef).sort((a, b) => b.creeLe.localeCompare(a.creeLe));
  const ecartes = souvenirs.filter((s) => s.refuse);
  const perso = Object.entries(lireDecisionsPerso());
  const persoGardes = perso.filter(([, d]) => d.decision === "garde");
  const persoEcartes = perso.filter(([, d]) => d.decision === "refuse");
  const prenom = (id: string | null) => foyer.membres.find((m) => m.id === id)?.prenom;

  const regler = (c: Partial<Adaptations>) => changerAdaptations(c);

  async function oublier(s: Souvenir) {
    await depot.supprimerSouvenir(s.id);
    annoncer("Kora l'a oublié.", () => depot.enregistrerSouvenir(s));
  }

  async function reproposer() {
    for (const s of ecartes) await depot.supprimerSouvenir(s.id);
    for (const [cle] of persoEcartes) oublierDecisionPerso(cle);
    annoncer("Les apprentissages écartés pourront revenir au bilan.", async () => {
      for (const s of ecartes) await depot.enregistrerSouvenir(s);
    });
  }

  const plusieurs = foyer.membres.length > 1;
  const jAccepte = !!membreId && !!foyer.equilibre?.includes(membreId);
  const autres = foyer.membres.filter((m) => m.id !== membreId);
  const enAttente = autres.filter((m) => !foyer.equilibre?.includes(m.id));

  return (
    <main className="appris">
      <h1>Ce que Kora sait de nous</h1>
      <p className="discret">Kora apprend de votre usage, sans IA et sans rien envoyer d'autre que ce que vous gardez. Chaque dimanche, le bilan propose deux ou trois choses ; rien n'est retenu sans accord.</p>

      <button className="carte proposition appris-bilan" onClick={props.ouvrirBilan}>
        <span className="pictogramme"><Icone nom="appris" taille={20} /></span>
        <span className="proposition-texte">
          <strong>Voir le bilan maintenant</strong>
          <span className="discret">Ce que Kora a remarqué et qui attend ta réponse.</span>
        </span>
        <Icone nom="suivant" taille={18} />
      </button>

      <h2 className="rayon">Appris sur le foyer</h2>
      {appris.length === 0 ? (
        <p className="discret appris-vide">Rien encore. Ce que vous garderez au bilan apparaîtra ici, et {nomFee()} le relira.</p>
      ) : (
        <ul className="carte groupe">
          {appris.map((s) => (
            <li key={s.id}>
              <Glissable onSupprimer={() => void oublier(s)} libelle="Oublier">
                <div className="ligne">
                  <span className="ligne-texte">
                    {s.texte}
                    <span className="bulle-note">{prenom(s.auteur) ? `Gardé par ${prenom(s.auteur)}` : "Gardé au bilan"}</span>
                  </span>
                </div>
              </Glissable>
            </li>
          ))}
        </ul>
      )}

      {gouts.length > 0 && (
        <>
          <h2 className="rayon">Les goûts, pour le Chef</h2>
          <ul className="carte groupe">
            {gouts.map((s) => (
              <li key={s.id}>
                <Glissable onSupprimer={() => void oublier(s)} libelle="Oublier">
                  <div className="ligne">
                    <span className={`gout${s.cle?.startsWith("chef:aime:") ? " aime" : ""}`} aria-hidden>
                      <Icone nom={s.cle?.startsWith("chef:aime:") ? "coeur" : "fermer"} taille={14} />
                    </span>
                    <span className="ligne-texte">{s.texte.replace(/^[^:]+ : /, "")}</span>
                  </div>
                </Glissable>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="rayon">Rien qu'à toi</h2>
      <ul className="carte groupe">
        <Interrupteur
          titre="Observer mon usage"
          detail="Les widgets que tu ouvres et l'heure de tes tâches, notés sur ce téléphone seulement."
          actif={adaptations.observer}
          changer={(observer) => regler({ observer })}
        />
        <Interrupteur
          titre="Accueil qui s'adapte"
          detail="Le matin, le midi et le soir, ce que tu ouvres le plus passe devant (après ce qui presse)."
          actif={adaptations.accueilVivant}
          changer={(accueilVivant) => regler({ accueilVivant })}
        />
        <Interrupteur
          titre={`Le mot du jour de ${nomFee()}`}
          detail="Une remarque utile sur l'accueil, une fois par jour au plus."
          actif={adaptations.remarques}
          changer={(remarques) => regler({ remarques })}
        />
      </ul>
      {persoGardes.length > 0 && (
        <ul className="carte groupe">
          {persoGardes.map(([cle, d]) => (
            <li key={cle}>
              <Glissable onSupprimer={() => oublierDecisionPerso(cle)} libelle="Oublier">
                <div className="ligne">
                  <span className="ligne-texte">{d.fait}</span>
                </div>
              </Glissable>
            </li>
          ))}
        </ul>
      )}
      <button className="lien appris-effacer" onClick={() => { effacerUsages(); annoncer("Ton usage noté est effacé.", () => {}); }}>
        Effacer ce que Kora a noté de mon usage
      </button>

      {plusieurs && (
        <>
          <h2 className="rayon">L'équilibre des tâches</h2>
          <div className="carte appris-equilibre">
            <p>Qui fait quoi, vu avec douceur sur la page des tâches. Il ne s'affiche que si vous dites oui tous les deux, et chacun peut retirer son accord.</p>
            {membreId && (
              <button className={jAccepte ? "bouton-secondaire" : "bouton-principal"} onClick={() => void depot.enregistrerFoyer(accepterEquilibre(foyer, membreId, !jAccepte))}>
                {jAccepte ? "Retirer mon accord" : "Je suis d'accord"}
              </button>
            )}
            <p className="discret">
              {equilibreVisible(foyer)
                ? "Vous avez dit oui tous les deux : il s'affiche sur la page des tâches."
                : jAccepte && enAttente.length
                  ? `${enAttente.map((m) => m.prenom).join(" et ")} n'a pas encore répondu.`
                  : "Personne ne le voit tant que vous n'êtes pas d'accord tous les deux."}
            </p>
          </div>
        </>
      )}

      {(ecartes.length > 0 || persoEcartes.length > 0) && (
        <button className="lien appris-effacer" onClick={() => void reproposer()}>
          Reproposer les {ecartes.length + persoEcartes.length} apprentissages écartés
        </button>
      )}
      <button className="lien appris-effacer" onClick={props.ouvrirMemoire}>Toute la mémoire de {nomFee()}</button>
    </main>
  );
}
