import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as PointerEventReact } from "react";
import { LIBELLES_VUES, VUES_CAPSULE, vueVoisine, type EtatCapsule, type VueCapsule } from "../../domaine/capsule";
import { astuceCapsuleAMontrer, compterAstuceCapsule, finirAstuceCapsule } from "../capsule";
import { nomFee } from "../fee";
import { vibrer } from "../haptique";

// La capsule vivante (0.0.100) : la barre du bas réinventée, un seul objet en verre. À gauche
// l'orbe de la fée (toucher pour parler, appui long pour écrire), au milieu ce qui compte
// maintenant dans la vue, avec son fil laiton, à droite trois tirets pour les trois vues.
// Glisser à gauche ou à droite change de vue, pousser vers le haut ouvre « Tout Kora »,
// toucher le milieu ouvre ce qu'elle dit. Chaque geste a aussi son bouton (VoiceOver, clavier).

const SEUIL_GLISSE = 40;
const SEUIL_HAUT = 36;
const APPUI_LONG_MS = 480;

export function Capsule(props: {
  vue: VueCapsule;
  etat: EtatCapsule;
  aller: (vue: VueCapsule) => void;
  ouvrir: () => void;
  ouvrirTout: () => void;
  toucherFee: () => void;
  appuiLongFee: () => void;
}) {
  const [astuce, setAstuce] = useState(astuceCapsuleAMontrer);
  const piste = useRef<HTMLSpanElement>(null);
  const geste = useRef<{ x: number; y: number; bouge: boolean } | null>(null);
  const appui = useRef<{ minuterie: number; long: boolean } | null>(null);

  useEffect(() => {
    if (!astuce) return;
    compterAstuceCapsule();
    const id = setTimeout(() => setAstuce(false), 6000);
    return () => clearTimeout(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const aller = (vue: VueCapsule) => {
    if (vue === props.vue) return;
    vibrer();
    setAstuce(false);
    props.aller(vue);
  };

  // ----- Glisser sur la capsule -----
  const debut = (e: PointerEventReact) => {
    if ((e.target as HTMLElement).closest(".capsule-orbe, .capsule-tirets")) return;
    geste.current = { x: e.clientX, y: e.clientY, bouge: false };
  };
  const bouge = (e: PointerEventReact) => {
    const g = geste.current;
    if (!g) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.bouge && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      g.bouge = true;
      // Le doigt peut sortir de la capsule (vers le haut) : elle garde le geste jusqu'au bout.
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    }
    if (piste.current && Math.abs(dx) > Math.abs(dy)) piste.current.style.transform = `translateX(${dx * 0.35}px)`;
  };
  const fin = (e: PointerEventReact) => {
    const g = geste.current;
    geste.current = null;
    if (piste.current) piste.current.style.transform = "";
    if (!g) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (Math.abs(dx) > SEUIL_GLISSE && Math.abs(dx) > Math.abs(dy)) {
      finirAstuceCapsule();
      aller(vueVoisine(props.vue, dx < 0 ? 1 : -1));
    } else if (dy < -SEUIL_HAUT && Math.abs(dy) > Math.abs(dx)) {
      vibrer();
      props.ouvrirTout();
    }
    // Un geste qui a bougé n'est pas un toucher : le bouton du milieu ne l'ouvre pas.
    if (g.bouge) {
      const bloquer = (c: MouseEvent) => {
        c.stopPropagation();
        c.preventDefault();
      };
      window.addEventListener("click", bloquer, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", bloquer, { capture: true }), 0);
    }
  };

  // ----- L'orbe : toucher pour parler, appui long pour écrire -----
  const appuiOrbe = () => {
    const minuterie = window.setTimeout(() => {
      if (!appui.current) return;
      appui.current.long = true;
      vibrer();
      props.appuiLongFee();
    }, APPUI_LONG_MS);
    appui.current = { minuterie, long: false };
  };
  const lacherOrbe = () => {
    if (appui.current) clearTimeout(appui.current.minuterie);
  };
  const toucherOrbe = () => {
    const long = appui.current?.long;
    appui.current = null;
    if (!long) props.toucherFee();
  };

  const teinteAutre = typeof document !== "undefined" && document.documentElement.dataset.fee === "bleue" ? "violette" : "bleue";
  const style = { "--fil": `${Math.round(props.etat.progression * 100)}%` } as CSSProperties;

  return (
    <div className="capsule-zone" data-geste-propre>
      <div
        className={`capsule${props.etat.ton === "autre" ? ` ton-autre fee-${teinteAutre}` : ""}`}
        role="group"
        aria-label="Kora"
        style={style}
        onPointerDown={debut}
        onPointerMove={bouge}
        onPointerUp={fin}
        onPointerCancel={() => {
          geste.current = null;
          if (piste.current) piste.current.style.transform = "";
        }}
      >
        {astuce && (
          <span className="capsule-astuce" aria-hidden>
            Glisse pour changer · touche pour ouvrir
          </span>
        )}
        <button
          type="button"
          className="capsule-orbe"
          aria-label={`Parler à ${nomFee()}`}
          onPointerDown={appuiOrbe}
          onPointerUp={lacherOrbe}
          onPointerLeave={lacherOrbe}
          onContextMenu={(e) => e.preventDefault()}
          onClick={toucherOrbe}
        />
        <button type="button" className="capsule-texte" onClick={props.ouvrir} aria-label={`${props.etat.petit}. ${props.etat.grand}. Ouvrir`}>
          <span className="capsule-piste" ref={piste} key={`${props.vue}-${props.etat.grand}`}>
            <small>{props.etat.petit}</small>
            <b>{props.etat.grand}</b>
          </span>
        </button>
        <div className="capsule-tirets" role="tablist" aria-label="Vues">
          {VUES_CAPSULE.map((v) => (
            <button key={v} type="button" role="tab" aria-selected={v === props.vue} aria-label={LIBELLES_VUES[v]} onClick={() => aller(v)}>
              <i />
            </button>
          ))}
        </div>
        <span className="capsule-fil" aria-hidden>
          <i />
        </span>
        <button type="button" className="cache-visuel" onClick={props.ouvrirTout}>
          Tout Kora
        </button>
      </div>
    </div>
  );
}
