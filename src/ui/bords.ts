/**
 * Les bords de côté de l'écran que l'iPhone garde pour lui (Kora 0.0.92). Sur l'iPhone Duo plié,
 * une colonne de 84 points à droite porte l'heure et l'île dynamique ; ailleurs ils valent 0.
 * Les styles les lisent dans `--bord-gauche` et `--bord-droit` (base.css) ; le code, par cette
 * mesure, faite sur un témoin invisible pour suivre exactement ce que voient les styles.
 */
export function bordsSurs(): { gauche: number; droite: number } {
  const temoin = document.createElement("div");
  temoin.style.cssText = "position:fixed;top:0;height:0;left:var(--bord-gauche,0px);right:var(--bord-droit,0px);visibility:hidden;pointer-events:none";
  document.body.appendChild(temoin);
  const r = temoin.getBoundingClientRect();
  temoin.remove();
  return { gauche: Math.max(0, r.left), droite: Math.max(0, window.innerWidth - r.right) };
}

/**
 * La hauteur cachée par le clavier, ou 0. Juste après un pli de l'iPhone Duo ou à la fermeture du
 * clavier, l'iPhone peut donner une zone visible de hauteur négative ou absurde dans l'app
 * installée : on l'ignore plutôt que de pousser la saisie hors de l'écran.
 */
export function hauteurClavier(hauteurFenetre: number, visible: { height: number; offsetTop: number }): number {
  const { height, offsetTop } = visible;
  if (!Number.isFinite(height) || !Number.isFinite(offsetTop) || height <= 0 || height > hauteurFenetre + 1) return 0;
  const h = Math.max(0, hauteurFenetre - height - offsetTop);
  return h > 80 && h < hauteurFenetre * 0.8 ? h : 0;
}
