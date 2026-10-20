import { useState, type FormEvent, type ReactNode } from "react";
import { accepterEquilibre, equilibreVisible } from "../../domaine/apprentissage";
import { corrigerSouvenir, nouveauSouvenir, trierSouvenirs, type Souvenir } from "../../domaine/memoire";
import type { RetourTest } from "../../domaine/retours";
import type { Depot } from "../../donnees/depot";
import { useAnnoncer } from "../annulation";
import { contexteReel } from "../contexte";
import { nomFee } from "../fee";
import { Glissable } from "../Glissable";
import { vibrer } from "../haptique";
import { Icone } from "../Icone";
import type { DonneesModule } from "../modules";
import { Onglets, Page, useGestionnaireBarre } from "../pieces";
import { changerAdaptations, effacerUsages, lireAdaptations, lireDecisionsPerso, oublierDecisionPerso, useApprentissageLocal } from "../usage";
import { Ligne, ListeVivante } from "../moteur/pieces";

// Tout ce que Kora et la fée savent de vous, sur une seule page : le bilan de la semaine en
// haut, puis ce qui concerne le foyer (partagé), ce qui ne concerne que toi (sur ce téléphone)
// et les souhaits notés pour Claude. On apprend quelque chose à la fée en le lui disant.

export type OngletMemoire = "foyer" | "toi" | "souhaits";

/** Les souhaits que la fée a notés pour Claude, parmi les notes de test (le texte enregistré garde « Jarvis »). */
const estSouhait = (r: RetourTest) => r.ecran === "Jarvis" && r.texte.startsWith("Souhait pour Jarvis : ");
const PREFIXE_SOUHAIT = "Souhait pour Jarvis : ";

export function Memoire(props: { donnees: DonneesModule; depot: Depot; ouvrirBilan: () => void; onglet?: OngletMemoire }) {
  useApprentissageLocal();
  const [onglet, setOnglet] = useState<OngletMemoire>(props.onglet ?? "foyer");
  const annoncer = useAnnoncer();
  const { depot } = props;
  const { foyer, membreId } = props.donnees;
  const souhaits = props.donnees.retours.filter(estSouhait).sort((a, b) => b.creeLe.localeCompare(a.creeLe));

  // Ce qu'on dit à la fée sur cette page, elle le retient.
  useGestionnaireBarre("memoire", async (texte) => {
    const phrase = texte.trim().replace(/^(retiens|souviens-toi|note) (que |qu')?/i, "");
    if (!phrase || phrase.endsWith("?")) return false;
    const s = nouveauSouvenir(phrase.charAt(0).toUpperCase() + phrase.slice(1), "demande", membreId, contexteReel);
    await depot.enregistrerSouvenir(s);
    vibrer();
    annoncer(`${nomFee()} l'a retenu.`, () => depot.supprimerSouvenir(s.id));
    return true;
  });

  return (
    <Page
      titre={`Ce que ${nomFee()} sait`}
      sousTitre="Rien n'est retenu sans votre accord"
      aide={{ cle: "memoire", texte: `Dis à ${nomFee()} « retiens que Sarah n'aime pas la coriandre ». Touche une ligne pour la corriger, glisse-la vers la gauche pour l'oublier.` }}
    >
      <button className="carte proposition appris-bilan" onClick={props.ouvrirBilan}>
        <span className="pictogramme"><Icone nom="appris" taille={20} /></span>
        <span className="proposition-texte">
          <strong>Le bilan de la semaine</strong>
          <span className="discret">Ce que Kora a remarqué et qui attend ta réponse.</span>
        </span>
        <Icone nom="suivant" taille={18} />
      </button>
      <Onglets
        libelle="Mémoire"
        onglets={[
          { id: "foyer", libelle: "Le foyer" },
          { id: "toi", libelle: "Rien qu'à toi" },
          { id: "souhaits", libelle: "Souhaits", compte: souhaits.filter((r) => !r.regleLe).length },
        ]}
        actif={onglet}
        changer={setOnglet}
      />
      {onglet === "foyer" && <LeFoyer {...props} />}
      {onglet === "toi" && <RienQuATOi />}
      {onglet === "souhaits" && <Souhaits souhaits={souhaits} />}
      {onglet === "foyer" && foyer.membres.length > 1 && membreId && (
        <Equilibre>
          <button
            className={foyer.equilibre?.includes(membreId) ? "bouton-secondaire" : "bouton-principal"}
            onClick={() => void depot.enregistrerFoyer(accepterEquilibre(foyer, membreId, !foyer.equilibre?.includes(membreId)))}
          >
            {foyer.equilibre?.includes(membreId) ? "Retirer mon accord" : "Je suis d'accord"}
          </button>
          <p className="discret">
            {equilibreVisible(foyer)
              ? "Vous avez dit oui tous les deux : il s'affiche sur la page des tâches."
              : foyer.equilibre?.includes(membreId)
                ? `${foyer.membres.filter((m) => m.id !== membreId).map((m) => m.prenom).join(" et ")} n'a pas encore répondu.`
                : "Personne ne le voit tant que vous n'êtes pas d'accord tous les deux."}
          </p>
        </Equilibre>
      )}
    </Page>
  );
}

/** Ce que le foyer a confié, gardé au bilan ou appris par le Chef : on corrige d'un toucher, on oublie d'un glissement. */
function LeFoyer(props: { donnees: DonneesModule; depot: Depot }) {
  const { depot } = props;
  const annoncer = useAnnoncer();
  const [edition, setEdition] = useState<{ id: string; texte: string } | null>(null);
  const souvenirs = trierSouvenirs(props.donnees.souvenirs);
  const ecartes = props.donnees.souvenirs.filter((s) => s.refuse);
  const persoEcartes = Object.entries(lireDecisionsPerso()).filter(([, d]) => d.decision === "refuse");
  const prenom = (id: string | null) => props.donnees.foyer.membres.find((m) => m.id === id)?.prenom;

  async function corriger(e: FormEvent, s: Souvenir) {
    e.preventDefault();
    if (!edition) return;
    if (edition.texte.trim() && edition.texte.trim() !== s.texte) await depot.enregistrerSouvenir(corrigerSouvenir(s, edition.texte));
    setEdition(null);
  }

  async function oublier(s: Souvenir) {
    await depot.supprimerSouvenir(s.id);
    annoncer(`${nomFee()} l'a oublié.`, () => depot.enregistrerSouvenir(s));
  }

  async function reproposer() {
    for (const s of ecartes) await depot.supprimerSouvenir(s.id);
    for (const [cle] of persoEcartes) oublierDecisionPerso(cle);
    annoncer("Les apprentissages écartés pourront revenir au bilan.", async () => {
      for (const s of ecartes) await depot.enregistrerSouvenir(s);
    });
  }

  const origine = (s: Souvenir) => {
    const qui = prenom(s.auteur);
    if (s.cle?.startsWith("chef:")) return "Un goût, pour le Chef";
    if (s.source === "remarque") return qui ? `Remarqué par ${nomFee()}, validé par ${qui}` : `Remarqué par ${nomFee()}`;
    if (s.source === "bilan") return qui ? `Appris par Kora, gardé par ${qui}` : "Appris par Kora";
    return qui ? `Confié par ${qui}` : `Confié à ${nomFee()}`;
  };

  return (
    <>
      {souvenirs.length === 0 ? (
        <p className="vide">{nomFee()} ne sait encore rien de particulier sur le foyer. Dis-lui « retiens que… ».</p>
      ) : (
        <ul className="carte groupe memoire">
          {souvenirs.map((s) => (
            <li key={s.id}>
              {edition?.id === s.id ? (
                <form className="ajout memoire-edition" onSubmit={(e) => void corriger(e, s)}>
                  <input value={edition.texte} onChange={(e) => setEdition({ id: s.id, texte: e.target.value })} onBlur={(e) => void corriger(e as unknown as FormEvent, s)} enterKeyHint="done" autoFocus aria-label="Corriger" />
                </form>
              ) : (
                <Glissable onSupprimer={() => void oublier(s)} libelle="Oublier">
                  <button className="ligne" onClick={() => setEdition({ id: s.id, texte: s.texte })}>
                    <span className="ligne-texte">
                      {s.texte}
                      <span className="bulle-note">{origine(s)}</span>
                    </span>
                  </button>
                </Glissable>
              )}
            </li>
          ))}
        </ul>
      )}
      {(ecartes.length > 0 || persoEcartes.length > 0) && (
        <button className="lien appris-effacer" onClick={() => void reproposer()}>
          Reproposer les {ecartes.length + persoEcartes.length} apprentissages écartés
        </button>
      )}
    </>
  );
}

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

/** Ce que Kora apprend de ton usage, gardé sur ce téléphone seulement. */
function RienQuATOi() {
  const annoncer = useAnnoncer();
  const adaptations = lireAdaptations();
  const gardes = Object.entries(lireDecisionsPerso()).filter(([, d]) => d.decision === "garde");
  return (
    <>
      <p className="discret">Kora apprend de ton usage sans IA, et rien de ceci ne quitte ce téléphone.</p>
      <ul className="carte groupe">
        <Interrupteur
          titre="Observer mon usage"
          detail="Les widgets que tu ouvres et l'heure de tes tâches, notés sur ce téléphone seulement."
          actif={adaptations.observer}
          changer={(observer) => changerAdaptations({ observer })}
        />
        <Interrupteur
          titre="Accueil qui s'adapte"
          detail="Le matin, le midi et le soir, ce que tu ouvres le plus passe devant (après ce qui presse)."
          actif={adaptations.accueilVivant}
          changer={(accueilVivant) => changerAdaptations({ accueilVivant })}
        />
        <Interrupteur
          titre={`Le mot du jour de ${nomFee()}`}
          detail="Une remarque utile sur l'accueil, une fois par jour au plus."
          actif={adaptations.remarques}
          changer={(remarques) => changerAdaptations({ remarques })}
        />
      </ul>
      {gardes.length > 0 && (
        <ListeVivante className="carte groupe">
          {gardes.map(([cle, d]) => (
            <Ligne key={cle}>
              <Glissable onSupprimer={() => oublierDecisionPerso(cle)} libelle="Oublier">
                <div className="ligne">
                  <span className="ligne-texte">{d.fait}</span>
                </div>
              </Glissable>
            </Ligne>
          ))}
        </ListeVivante>
      )}
      <button className="lien appris-effacer" onClick={() => { effacerUsages(); annoncer("Ton usage noté est effacé.", () => {}); }}>
        Effacer ce que Kora a noté de mon usage
      </button>
    </>
  );
}

function Souhaits({ souhaits }: { souhaits: RetourTest[] }) {
  if (souhaits.length === 0) {
    return <p className="discret">Quand tu demandes à {nomFee()} une chose qu'elle ne sait pas encore faire, elle la note ici. Claude les lit et en fait de nouvelles versions.</p>;
  }
  return (
    <ul className="carte groupe">
      {souhaits.map((r) => (
        <li key={r.id} className="ligne">
          <span className="ligne-texte">
            {r.texte.replace(PREFIXE_SOUHAIT, "")}
            <span className="bulle-note">{r.regleLe ? "Fait dans une nouvelle version" : "Transmis à Claude"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Equilibre({ children }: { children: ReactNode }) {
  return (
    <>
      <h2 className="rayon">L'équilibre des tâches</h2>
      <div className="carte appris-equilibre">
        <p>Qui fait quoi, vu avec douceur sur la page des tâches. Il ne s'affiche que si vous dites oui tous les deux, et chacun peut retirer son accord.</p>
        {children}
      </div>
    </>
  );
}
