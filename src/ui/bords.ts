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
