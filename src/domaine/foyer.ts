import type { Contexte, Foyer, Id, Liste, Membre } from "./types";

export const COULEURS_MEMBRES = ["#E07A5F", "#3D85C6", "#81B29A", "#F2CC8F", "#9B72CF"];

export class ErreurValidation extends Error {}

/** Crée un foyer à partir de son nom et des prénoms de ses membres. */
export function creerFoyer(nom: string, prenoms: string[], ctx: Contexte): Foyer {
  const nomPropre = nom.trim();
  const prenomsPropres = prenoms.map((p) => p.trim()).filter((p) => p.length > 0);
  if (nomPropre.length === 0) throw new ErreurValidation("Le foyer doit avoir un nom.");
  if (prenomsPropres.length === 0) throw new ErreurValidation("Ajoute au moins un membre.");
  const doublon = prenomsPropres.find(
    (p, i) => prenomsPropres.findIndex((q) => q.toLowerCase() === p.toLowerCase()) !== i,
  );
  if (doublon) throw new ErreurValidation(`« ${doublon} » est présent deux fois.`);

  const membres: Membre[] = prenomsPropres.map((prenom, i) => ({
    id: ctx.nouvelId(),
    prenom,
    couleur: COULEURS_MEMBRES[i % COULEURS_MEMBRES.length],
  }));
  return { id: ctx.nouvelId(), nom: nomPropre, membres, creeLe: ctx.maintenant() };
}

/** Listes créées avec un nouveau foyer. */
export function listesInitiales(ctx: Contexte): Liste[] {
  return [
    { id: ctx.nouvelId(), nom: "Courses", icone: "🛒", type: "courses", creeLe: ctx.maintenant() },
    { id: ctx.nouvelId(), nom: "Maison", icone: "🔧", type: "simple", creeLe: ctx.maintenant() },
  ];
}

// ----- Les téléphones du foyer -----
// Chaque téléphone note sur son membre la version de Kora qu'il a et le jour où il s'est ouvert :
// dans Réglages › Partage, on voit si l'autre est resté sur une vieille version.

/** Le foyer à réenregistrer, ou null si rien n'a changé (même version, déjà vu aujourd'hui). */
export function noterAppareil(foyer: Foyer, membreId: Id | null, version: string, maintenant: string): Foyer | null {
  const membre = foyer.membres.find((m) => m.id === membreId);
  if (!membre) return null;
  const a = membre.appareil;
  if (a && a.version === version && a.vuLe.slice(0, 10) === maintenant.slice(0, 10)) return null;
  return { ...foyer, membres: foyer.membres.map((m) => (m.id === membreId ? { ...m, appareil: { version, vuLe: maintenant } } : m)) };
}

export interface AppareilDecrit {
  prenom: string;
  /** « Kora 0.0.64 », ou « Jamais ouverte » */
  version: string;
  detail: string;
  /** Plus ancienne que celle de ce téléphone. */
  enRetard: boolean;
}

export function decrireAppareils(foyer: Pick<Foyer, "membres">, versionCourante: string, maintenant: string): AppareilDecrit[] {
  return foyer.membres.map((m) => {
    if (!m.appareil) return { prenom: m.prenom, version: "Jamais ouverte", detail: "Kora ne s'est pas encore ouverte sur son iPhone.", enRetard: false };
    const jours = Math.floor((Date.parse(maintenant) - Date.parse(m.appareil.vuLe)) / 86_400_000);
    const vu = jours <= 0 ? "ouverte aujourd'hui" : jours === 1 ? "ouverte hier" : `ouverte il y a ${jours} jours`;
    const enRetard = comparerVersions(m.appareil.version, versionCourante) < 0;
    return { prenom: m.prenom, version: `Kora ${m.appareil.version}`, detail: enRetard ? `${vu} · une mise à jour l'attend` : vu, enRetard };
  });
}

/** « 0.0.9 » < « 0.0.64 » : les numéros se comparent un à un. */
export function comparerVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

// ----- Les téléphones reliés au serveur (Kora 0.0.82) -----
// Chaque installation de Kora est un compte membre du foyer sur le serveur (dix au plus). Réglages ›
// Partage les liste : on retire une vieille installation, ou un téléphone perdu, et on change le code.

/** Un téléphone relié, tel que le serveur le décrit (fonction appareils_foyer). */
export interface TelephoneRelie {
  id: string;
  /** Ce que le téléphone a dit de lui ; null pour une installation d'avant Kora 0.0.82. */
  nom: string | null;
  rejointLe: string;
  actifLe: string | null;
  moi: boolean;
}

export interface TelephoneDecrit {
  id: string;
  titre: string;
  detail: string;
  moi: boolean;
  /** Sans activité depuis 14 jours : sans doute une ancienne installation. */
  ancien: boolean;
}

/** Au-delà, un téléphone est montré comme une ancienne installation. */
export const JOURS_ANCIEN = 14;

/** Le nom qu'un téléphone donne de lui : « Dany · iPhone · Kora 0.0.82 ». */
export function nomTelephone(prenom: string | null, plateforme: string, version: string): string {
  return [prenom, plateforme, `Kora ${version}`].filter(Boolean).join(" · ");
}

/** « iPad » ou « iPhone » (ou « Navigateur ») depuis ce que dit le navigateur. */
export function plateformeDe(agent: string, pointsTactiles = 0): string {
  // Un iPad récent se présente comme un Mac, mais avec un écran tactile.
  if (/iPad/.test(agent) || (/Macintosh/.test(agent) && pointsTactiles > 1)) return "iPad";
  if (/iPhone|iPod/.test(agent)) return "iPhone";
  if (/Android/.test(agent)) return "Android";
  if (/Macintosh/.test(agent)) return "Mac";
  return "Navigateur";
}

function ilYa(depuis: string, maintenant: string): string {
  const jours = Math.floor((Date.parse(maintenant) - Date.parse(depuis)) / 86_400_000);
  return jours <= 0 ? "aujourd'hui" : jours === 1 ? "hier" : `il y a ${jours} jours`;
}

/** Les lignes de la liste : ce téléphone d'abord, puis les actifs, puis les anciens. */
export function decrireTelephones(telephones: readonly TelephoneRelie[], maintenant: string): TelephoneDecrit[] {
  const lignes = telephones.map((t) => {
    const vu = t.actifLe ?? t.rejointLe;
    const ancien = !t.moi && Date.parse(maintenant) - Date.parse(vu) > JOURS_ANCIEN * 86_400_000;
    const titre = t.nom ?? "Ancienne installation";
    const detail = t.moi ? "Ce téléphone" : ancien ? `Pas ouvert depuis ${ilYa(vu, maintenant).replace("il y a ", "")}` : `Ouvert ${ilYa(vu, maintenant)}`;
    return { id: t.id, titre, detail, moi: t.moi, ancien, vu };
  });
  const rang = (l: (typeof lignes)[number]) => (l.moi ? 0 : l.ancien ? 2 : 1);
  return lignes
    .sort((a, b) => rang(a) - rang(b) || b.vu.localeCompare(a.vu))
    .map(({ vu: _vu, ...l }) => l);
}

/**
 * Pour la carte « Chez nous » de l'accueil (Kora 0.0.85) : l'autre iPhone resté sur une version
 * plus ancienne, en une ligne (« Sarah a encore Kora 0.0.81 »), ou null. Un appareil pas ouvert
 * depuis plus de 14 jours ne compte pas : c'est sans doute un ancien téléphone.
 */
export function ligneRetard(foyer: Pick<Foyer, "membres">, membreId: Id | null, versionCourante: string, maintenant: string): string | null {
  const enRetard = foyer.membres.filter(
    (m) =>
      m.id !== membreId &&
      m.appareil &&
      comparerVersions(m.appareil.version, versionCourante) < 0 &&
      Date.parse(maintenant) - Date.parse(m.appareil.vuLe) <= JOURS_ANCIEN * 86_400_000,
  );
  if (!enRetard.length) return null;
  return enRetard.map((m) => `${m.prenom} a encore Kora ${m.appareil!.version}`).join(", ");
}
