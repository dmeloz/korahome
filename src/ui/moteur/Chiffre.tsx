import NumberFlow from "@number-flow/react";

// Les chiffres qui roulent (NumberFlow) : quand un montant ou un compte change, chaque chiffre
// tourne jusqu'à sa nouvelle valeur, comme un compteur, au lieu de sauter. Le mouvement est le
// ressort « chiffre » du moteur, lu dans les styles (--ressort-chiffre) ; sans lui, NumberFlow
// garde le sien. Si l'iPhone demande moins d'animations, le chiffre change sans tourner.
// Équivalent natif : Text(montant, format: .currency(code: "CHF")).contentTransition(.numericText()).

let mouvement: { transformTiming: EffectTiming; spinTiming: EffectTiming } | null | undefined;

/** Le ressort « chiffre », pris une fois dans les styles. */
function ressortChiffre() {
  if (mouvement !== undefined) return mouvement ?? undefined;
  const style = getComputedStyle(document.documentElement);
  const easing = style.getPropertyValue("--ressort-chiffre").trim();
  const duration = parseFloat(style.getPropertyValue("--ressort-chiffre-duree"));
  // Les ressorts arrivent juste après le premier écran : on ne retient rien tant qu'ils manquent.
  if (!easing || !duration) return undefined;
  mouvement = { transformTiming: { duration, easing }, spinTiming: { duration, easing } };
  return mouvement;
}

/** Un nombre entier (« 3 à faire »). */
export function Chiffre(props: { valeur: number; className?: string }) {
  return <NumberFlow className={props.className} value={props.valeur} locales="de-CH" {...ressortChiffre()} />;
}

/** Un montant écrit comme formaterMontant (domaine/budget.ts) : « 1’185.50 CHF », « 84 CHF ». */
export function Montant(props: { valeur: number; className?: string; sansDevise?: boolean }) {
  const centimes = Math.round(Math.abs(props.valeur) * 100) % 100 !== 0;
  return (
    <NumberFlow
      className={props.className}
      value={Math.round(props.valeur * 100) / 100}
      locales="de-CH"
      format={{ minimumFractionDigits: centimes ? 2 : 0, maximumFractionDigits: 2 }}
      suffix={props.sansDevise ? undefined : " CHF"}
      {...ressortChiffre()}
    />
  );
}
