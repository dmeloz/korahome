import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

// Après une suppression d'un glissement, un bandeau « Annuler » reste six secondes :
// le geste est rapide, il doit pouvoir se rattraper.

type Annoncer = (texte: string, annuler: () => unknown) => void;

const Contexte = createContext<Annoncer>(() => {});

export const useAnnoncer = () => useContext(Contexte);

export function FournisseurAnnulation({ children }: { children: ReactNode }) {
  const [annonce, setAnnonce] = useState<{ texte: string; annuler: () => unknown; n: number } | null>(null);

  useEffect(() => {
    if (!annonce) return;
    const minuterie = setTimeout(() => setAnnonce(null), 6000);
    return () => clearTimeout(minuterie);
  }, [annonce]);

  const annoncer = useCallback<Annoncer>((texte, annuler) => setAnnonce((a) => ({ texte, annuler, n: (a?.n ?? 0) + 1 })), []);

  return (
    <Contexte.Provider value={annoncer}>
      {children}
      {annonce && (
        <div className="toast" role="status" key={annonce.n}>
          <span>{annonce.texte}</span>
          <button
            className="lien"
            onClick={() => {
              void annonce.annuler();
              setAnnonce(null);
            }}
          >
            Annuler
          </button>
        </div>
      )}
    </Contexte.Provider>
  );
}
