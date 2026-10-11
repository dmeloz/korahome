import { useEffect, useRef, useState } from "react";

// Le scan d'un code-barres avec l'appareil photo. Safari sur iPhone n'a pas encore le
// détecteur de codes-barres du navigateur : on le remplace alors par ZXing compilé en
// WebAssembly, chargé seulement à l'ouverture du scan et gardé hors ligne avec l'app.

interface Detecteur {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

async function creerDetecteur(): Promise<Detecteur> {
  const natif = (globalThis as { BarcodeDetector?: new (o: { formats: string[] }) => Detecteur }).BarcodeDetector;
  if (natif) return new natif({ formats: FORMATS });
  const [{ BarcodeDetector, setZXingModuleOverrides }, { default: adresseWasm }] = await Promise.all([
    import("barcode-detector/ponyfill"),
    import("zxing-wasm/reader/zxing_reader.wasm?url"),
  ]);
  setZXingModuleOverrides({ locateFile: (chemin: string, prefixe: string) => (chemin.endsWith(".wasm") ? adresseWasm : prefixe + chemin) });
  return new BarcodeDetector({ formats: FORMATS as never });
}

export default function Scanner(props: { trouve: (code: string) => void; fermer: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [saisie, setSaisie] = useState("");
  const { trouve } = props;

  useEffect(() => {
    let flux: MediaStream | null = null;
    let fini = false;
    let minuterie = 0;

    async function demarrer() {
      try {
        flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 } }, audio: false });
        if (fini) return flux.getTracks().forEach((t) => t.stop());
        const v = video.current!;
        v.srcObject = flux;
        await v.play();
        const detecteur = await creerDetecteur();
        const chercher = async () => {
          if (fini) return;
          try {
            if (v.readyState >= 2) {
              const [code] = await detecteur.detect(v);
              if (code?.rawValue && !fini) {
                fini = true;
                navigator.vibrate?.(30);
                return trouve(code.rawValue);
              }
            }
          } catch {
            // Une image illisible : on réessaie à la suivante.
          }
          minuterie = window.setTimeout(() => void chercher(), 180);
        };
        void chercher();
      } catch (e) {
        const refuse = e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError");
        setErreur(
          refuse
            ? "L'appareil photo n'est pas autorisé. Réglages de l'iPhone > Safari > Appareil photo, ou tape le code ci-dessous."
            : "L'appareil photo ne s'ouvre pas ici. Tape le code ci-dessous.",
        );
      }
    }
    void demarrer();
    return () => {
      fini = true;
      clearTimeout(minuterie);
      flux?.getTracks().forEach((t) => t.stop());
    };
  }, [trouve]);

  return (
    <div className="voile voile-scan" onClick={props.fermer}>
      <div className="scan" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Scanner un code-barres">
        <div className="scan-video">
          <video ref={video} playsInline muted />
          <div className="scan-viseur" aria-hidden />
          {erreur && <p className="scan-erreur">{erreur}</p>}
        </div>
        <p className="discret scan-aide">Vise le code-barres du produit. Kora lit son nom sur Open Food Facts.</p>
        <form
          className="ajout"
          onSubmit={(e) => {
            e.preventDefault();
            if (saisie.trim()) trouve(saisie.trim());
          }}
        >
          <input value={saisie} onChange={(e) => setSaisie(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Ou tape le code" aria-label="Code-barres" />
          <button type="submit" disabled={!saisie.trim()} aria-label="Chercher">→</button>
        </form>
        <button className="lien scan-fermer" onClick={props.fermer}>Fermer</button>
      </div>
    </div>
  );
}
