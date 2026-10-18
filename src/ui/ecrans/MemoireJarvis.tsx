import { useState, type FormEvent } from "react";
import { corrigerSouvenir, nouveauSouvenir, trierSouvenirs, type Souvenir } from "../../domaine/memoire";
import type { RetourTest } from "../../domaine/retours";
import type { Foyer } from "../../domaine/types";
import type { Depot } from "../../donnees/depot";
import { useAnnoncer } from "../annulation";
import { contexteReel } from "../contexte";
import { Glissable } from "../Glissable";
import { vibrer } from "../haptique";

/** Les souhaits que Jarvis a notés pour Claude, parmi les notes de test. */
const estSouhait = (r: RetourTest) => r.ecran === "Jarvis" && r.texte.startsWith("Souhait pour Jarvis : ");

// Ce que Jarvis sait du foyer : on le relit, on le corrige d'un toucher, on l'efface d'un
// glissement. Et les souhaits qu'il a notés pour Claude, avec leur état.
export function MemoireJarvis(props: { depot: Depot; foyer: Foyer; membreId: string | null; souvenirs: Souvenir[]; retours: RetourTest[] }) {
  const { depot } = props;
  const annoncer = useAnnoncer();
  const [saisie, setSaisie] = useState("");
  const [edition, setEdition] = useState<{ id: string; texte: string } | null>(null);
  const souvenirs = trierSouvenirs(props.souvenirs);
  const souhaits = props.retours.filter(estSouhait).sort((a, b) => b.creeLe.localeCompare(a.creeLe));
  const prenom = (id: string | null) => props.foyer.membres.find((m) => m.id === id)?.prenom;

  async function ajouter(e: FormEvent) {
    e.preventDefault();
    if (!saisie.trim()) return;
    await depot.enregistrerSouvenir(nouveauSouvenir(saisie, "demande", props.membreId, contexteReel));
    vibrer();
    setSaisie("");
  }

  async function corriger(e: FormEvent, s: Souvenir) {
    e.preventDefault();
    if (!edition) return;
    if (edition.texte.trim() && edition.texte.trim() !== s.texte) await depot.enregistrerSouvenir(corrigerSouvenir(s, edition.texte));
    setEdition(null);
  }

  async function oublier(s: Souvenir) {
    await depot.supprimerSouvenir(s.id);
    annoncer("Jarvis l'a oublié.", () => depot.enregistrerSouvenir(s));
  }

  const origine = (s: Souvenir) => {
    const qui = prenom(s.auteur);
    if (s.source === "remarque") return qui ? `Remarqué par Jarvis, validé par ${qui}` : "Remarqué par Jarvis";
    if (s.source === "bilan") return qui ? `Appris par Kora, gardé par ${qui}` : "Appris par Kora";
    return qui ? `Confié par ${qui}` : "Confié à Jarvis";
  };

  return (
    <main>
      <h1>Ce que Jarvis sait</h1>
      <p className="discret">
        Jarvis relit tout ceci à chaque demande. Dis-lui « retiens que… », ou écris-le ici. Quand il remarque une habitude, il demande avant de la retenir.
      </p>
      <form className="ajout" onSubmit={(e) => void ajouter(e)}>
        <input value={saisie} onChange={(e) => setSaisie(e.target.value)} placeholder="Ex. Sarah n'aime pas la coriandre" enterKeyHint="done" aria-label="Apprendre quelque chose à Jarvis" />
        <button type="submit" disabled={!saisie.trim()} aria-label="Retenir">+</button>
      </form>

      {souvenirs.length === 0 ? (
        <p className="vide">Jarvis ne sait encore rien de particulier sur le foyer.</p>
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

      <h2 className="rayon">Souhaits notés pour Claude</h2>
      {souhaits.length === 0 ? (
        <p className="discret">Quand tu demandes à Jarvis une chose qu'il ne sait pas encore faire, il la note ici. Claude les lit et en fait de nouvelles versions, que tu valides.</p>
      ) : (
        <ul className="carte groupe">
          {souhaits.map((r) => (
            <li key={r.id} className="ligne">
              <span className="ligne-texte">
                {r.texte.replace("Souhait pour Jarvis : ", "")}
                <span className="bulle-note">{r.regleLe ? "Fait dans une nouvelle version" : "Transmis à Claude"}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
