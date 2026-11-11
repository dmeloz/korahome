// Les petites vibrations au toucher, comme dans les apps de l'iPhone. Safari n'offre pas
// navigator.vibrate ; depuis iOS 18, basculer un interrupteur (« switch ») fait vibrer :
// un interrupteur invisible sert donc de moteur.

let interrupteur: HTMLLabelElement | null = null;

function moteur(): HTMLLabelElement {
  if (interrupteur) return interrupteur;
  const label = document.createElement("label");
  label.setAttribute("aria-hidden", "true");
  // Pas dans le journal des tests : chaque vibration y laissait un « checkbox » trompeur.
  label.dataset.journal = "non";
  label.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;left:-10px;top:0";
  const champ = document.createElement("input");
  champ.type = "checkbox";
  champ.setAttribute("switch", "");
  champ.tabIndex = -1;
  label.appendChild(champ);
  document.body.appendChild(label);
  interrupteur = label;
  return label;
}

/** Quand la vibration a déjà été donnée sous le doigt (vibrerAvant). */
let donnee = 0;

/** La vibration sous le doigt, avant un geste qui retarde l'action d'un souffle : le `vibrer()`
 *  de l'action qui suit, dans la seconde, ne vibre pas une deuxième fois. */
export function vibrerAvant(): void {
  vibrer();
  donnee = Date.now();
}

/** Une vibration brève : une case cochée, une tâche faite, un appui long. */
export function vibrer(): void {
  if (donnee && Date.now() - donnee < 1000) {
    donnee = 0;
    return;
  }
  donnee = 0;
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(10);
    return;
  }
  if (typeof document === "undefined") return;
  try {
    moteur().click();
  } catch {
    // Pas de vibration : rien de grave.
  }
}
