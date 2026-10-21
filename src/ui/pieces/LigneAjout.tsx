import { useRef, useState } from "react";

// La ligne « Nouvel article » des Rappels de l'iPhone : un rond vide et un champ au bout de la
// liste. On écrit, « Retour » ajoute et garde le clavier ouvert pour la suivante ; quitter le
// champ avec du texte l'ajoute aussi. Pas besoin de passer par la fée.
// Équivalent natif : une ligne TextField en fin de List, avec .onSubmit et @FocusState.

export function LigneAjout(props: {
  placeholder: string;
  ajouter: (texte: string) => void | Promise<void>;
  /** Le texte tenu par la page, pour proposer ce qui ressemble (les articles déjà achetés) et le vider. */
  texte?: string;
  onChange?: (texte: string) => void;
}) {
  const [interne, setInterne] = useState("");
  const texte = props.texte ?? interne;
  const envoi = useRef(false);
  const changer = (t: string) => {
    setInterne(t);
    props.onChange?.(t);
  };
  async function valider() {
    const t = texte.trim();
    if (!t || envoi.current) return;
    envoi.current = true;
    changer("");
    try {
      await props.ajouter(t);
    } finally {
      envoi.current = false;
    }
  }
  return (
    <form
      className="ligne ligne-ajout"
      onSubmit={(e) => {
        e.preventDefault();
        void valider();
      }}
    >
      <span className="case" aria-hidden />
      <input
        className="ligne-texte"
        value={texte}
        onChange={(e) => changer(e.target.value)}
        onBlur={() => void valider()}
        placeholder={props.placeholder}
        aria-label={props.placeholder}
        enterKeyHint="next"
        autoComplete="off"
        autoCorrect="on"
      />
    </form>
  );
}
