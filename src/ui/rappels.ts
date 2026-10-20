import { heureValide, minuteValide, nettoyerJours, PREFERENCES_DE_DEPART, type PreferencesRappels } from "../domaine/rappels";
import type { ServeurRappels } from "../donnees/distant";
import { CLES, ecrireJson, lireTexte } from "./stockageLocal";

// Les rappels du matin côté téléphone : demander la permission, inscrire l'iPhone
// auprès du serveur, retenir les choix de chacun. Sur iPhone, les notifications
// d'une app web ne marchent qu'ouverte depuis l'écran d'accueil (iOS 16.4 et plus).

export type EtatRappels =
  /** Ce navigateur ne sait pas recevoir de notifications. */
  | "impossible"
  /** Sur iPhone, dans Safari : il faut ouvrir KoraHome depuis l'écran d'accueil. */
  | "ecran-accueil"
  /** La personne a refusé : seuls les réglages de l'iPhone peuvent rouvrir. */
  | "refuses"
  | "inactifs"
  | "actifs";

export function diagnostiquer(n: {
  pushPossible: boolean;
  iPhone: boolean;
  ecranAccueil: boolean;
  permission: NotificationPermission | null;
  inscrit: boolean;
}): EtatRappels {
  if (!n.pushPossible) return n.iPhone && !n.ecranAccueil ? "ecran-accueil" : "impossible";
  if (n.permission === "denied") return "refuses";
  return n.permission === "granted" && n.inscrit ? "actifs" : "inactifs";
}

/** La clé publique du serveur, telle que l'attend PushManager.subscribe. */
export function cleEnOctets(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const brut = atob(base64);
  const octets = new Uint8Array(new ArrayBuffer(brut.length));
  for (let i = 0; i < brut.length; i++) octets[i] = brut.charCodeAt(i);
  return octets;
}

/** Ce que cette personne veut recevoir. Propre au téléphone, comme « qui utilise ce téléphone ». */
export function lirePreferences(): PreferencesRappels {
  const texte = lireTexte(CLES.rappels, false);
  try {
    if (texte === false) throw new Error("Stockage indisponible");
    const brut = JSON.parse(texte ?? "null");
    return {
      taches: typeof brut?.taches === "boolean" ? brut.taches : PREFERENCES_DE_DEPART.taches,
      mitsu: typeof brut?.mitsu === "boolean" ? brut.mitsu : PREFERENCES_DE_DEPART.mitsu,
      stock: typeof brut?.stock === "boolean" ? brut.stock : PREFERENCES_DE_DEPART.stock,
      jardin: typeof brut?.jardin === "boolean" ? brut.jardin : PREFERENCES_DE_DEPART.jardin,
      mots: typeof brut?.mots === "boolean" ? brut.mots : PREFERENCES_DE_DEPART.mots,
      agenda: typeof brut?.agenda === "boolean" ? brut.agenda : PREFERENCES_DE_DEPART.agenda,
      budget: typeof brut?.budget === "boolean" ? brut.budget : PREFERENCES_DE_DEPART.budget,
      heure: heureValide(brut?.heure) ? brut.heure : PREFERENCES_DE_DEPART.heure,
      minute: minuteValide(brut?.minute) ? brut.minute : 0,
      jours: nettoyerJours(brut?.jours),
    };
  } catch {
    return { ...PREFERENCES_DE_DEPART, jours: [...PREFERENCES_DE_DEPART.jours] };
  }
}

export function enregistrerPreferences(p: PreferencesRappels): void {
  // Stockage indisponible : le serveur garde quand même les choix envoyés.
  ecrireJson(CLES.rappels, p);
}

// ----- Le navigateur -----

const pushPossible = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

async function inscriptionActuelle(): Promise<PushSubscription | null> {
  if (!pushPossible()) return null;
  const sw = await navigator.serviceWorker.getRegistration();
  return (await sw?.pushManager.getSubscription()) ?? null;
}

export async function etatRappels(): Promise<EtatRappels> {
  const possible = pushPossible();
  return diagnostiquer({
    pushPossible: possible,
    iPhone: /iPhone|iPad|iPod/.test(navigator.userAgent),
    ecranAccueil: matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true,
    permission: possible ? Notification.permission : null,
    inscrit: (await inscriptionActuelle()) !== null,
  });
}

/**
 * Active les rappels : à appeler depuis un toucher (iOS n'ouvre la question
 * d'autorisation qu'après un geste). Renvoie l'état obtenu.
 */
export async function activerRappels(
  serveur: ServeurRappels,
  foyerId: string,
  membreId: string | null,
  preferences: PreferencesRappels,
): Promise<EtatRappels> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "refuses" : "inactifs";
  const sw = await navigator.serviceWorker.ready;
  const inscription =
    (await sw.pushManager.getSubscription()) ??
    (await sw.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cleEnOctets(await serveur.cleRappels()) }));
  await inscrire(serveur, inscription, foyerId, membreId, preferences);
  return "actifs";
}

async function inscrire(
  serveur: ServeurRappels,
  inscription: PushSubscription,
  foyerId: string,
  membreId: string | null,
  preferences: PreferencesRappels,
): Promise<void> {
  const json = inscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error("L'iPhone n'a pas donné d'adresse d'envoi.");
  await serveur.inscrireRappels({
    foyerId,
    membreId,
    endpoint: json.endpoint,
    cles: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    preferences,
  });
}

/** Les choix ont changé (ou la personne du téléphone) : le serveur suit. */
export async function mettreAJourRappels(
  serveur: ServeurRappels,
  foyerId: string,
  membreId: string | null,
  preferences: PreferencesRappels,
): Promise<void> {
  const inscription = await inscriptionActuelle();
  if (inscription) await inscrire(serveur, inscription, foyerId, membreId, preferences);
}

export async function desactiverRappels(serveur: ServeurRappels): Promise<void> {
  const inscription = await inscriptionActuelle();
  if (!inscription) return;
  await serveur.desinscrireRappels(inscription.endpoint);
  await inscription.unsubscribe();
}

export async function essayerRappel(serveur: ServeurRappels): Promise<void> {
  const inscription = await inscriptionActuelle();
  if (!inscription) throw new Error("Les rappels ne sont pas activés sur ce téléphone.");
  await serveur.essaiRappel(inscription.endpoint);
}

/**
 * La pastille rouge de l'icône KoraHome, comme celle de Messages : le nombre de choses
 * qui pressent (ce que contiendrait le rappel du matin). Zéro : pas de pastille.
 * Sur iPhone, elle s'affiche une fois les notifications autorisées.
 */
export function afficherPastilleIcone(nombre: number): void {
  const n = navigator as { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  (nombre > 0 ? n.setAppBadge?.(nombre) : n.clearAppBadge?.())?.catch(() => {});
}
