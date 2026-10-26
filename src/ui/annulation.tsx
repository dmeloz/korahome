import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Message } from "./moteur/pieces";
import { ecouterEchecs } from "./sauver";

// Après une suppression d'un glissement, un bandeau « Annuler » reste six secondes :
// le geste est rapide, il doit pouvoir se rattraper. Le même bandeau dit aussi, sans bouton,
// qu'un enregistrement lancé d'un toucher n'a pas pu se faire (sauver.ts).

type Annoncer = (texte: string, annuler: () => unknown) => void;

const Contexte = createContext<Annoncer>(() => {});

export const useAnnoncer = () => useContext(Contexte);

export function FournisseurAnnulation({ children }: { children: ReactNode }) {
  const [annonce, setAnnonce] = useState<{ texte: string; annuler: (() => unknown) | null; n: number } | null>(null);

  useEffect(() => ecouterEchecs((texte) => setAnnonce((a) => ({ texte, annuler: null, n: (a?.n ?? 0) + 1 }))), []);

  useEffect(() => {
    if (!annonce) return;
    const minuterie = setTimeout(() => setAnnonce(null), 6000);
    return () => clearTimeout(minuterie);
  }, [annonce]);

  const annoncer = useCallback<Annoncer>((texte, annuler) => setAnnonce((a) => ({ texte, annuler, n: (a?.n ?? 0) + 1 })), []);

  return (
    <Contexte.Provider value={annoncer}>
      {children}
      <Message visible={!!annonce} cle={annonce?.n}>
        {annonce && (
          <>
            <span>{annonce.texte}</span>
            {annonce.annuler && (
              <button
                className="lien"
                onClick={() => {
                  void annonce.annuler?.();
                  setAnnonce(null);
                }}
              >
                Annuler
              </button>
            )}
          </>
        )}
      </Message>
    </Contexte.Provider>
  );
}
