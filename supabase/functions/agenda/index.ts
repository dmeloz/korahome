// KoraHome : l'agenda commun relié à iCloud (Supabase Edge Function, Deno).
//
// - Un téléphone l'appelle avec sa session pour relier le compte iCloud de sa personne
//   (identifiant Apple et mot de passe d'app), choisir les calendriers lus, synchroniser tout
//   de suite, ou délier. Le mot de passe va dans le coffre du serveur (Vault) et n'en ressort
//   que pour parler à iCloud.
// - Chaque quart d'heure, le serveur l'appelle (pg_cron, voir supabase/schema.sql) avec sa clé
//   « x-cle-cron » : elle synchronise tous les comptes reliés.
//
// Pour chaque compte : le calendrier « Kora » de son iCloud reçoit tout l'agenda du foyer, ce qui
// y change sur l'iPhone revient dans Kora, et les autres calendriers choisis sont lus dans Kora
// (collection « agenda »). Les décisions viennent de src/domaine/icloud.ts (planSynchro), copié
// dans domaine.js par `npm run fonction`. Déploiement : docs/agenda.md.

import { messageErreur, preflight, repondre } from "../_shared/http.ts";
import { cleCronValide, echec, estMembre, serveur, utilisateur } from "../_shared/supabase.ts";
import {
  aRetirerDe,
  aujourdhuiAZurich,
  COULEUR_KORA,
  CORPS_CALENDRIERS,
  CORPS_MAISON,
  CORPS_PRINCIPAL,
  corpsCreerCalendrier,
  corpsEvenements,
  decaler,
  evenementsDe,
  idCompteIcloud,
  JOURS_A_VENIR,
  JOURS_PASSES,
  lireCalendriers,
  lireMultistatus,
  lireRessources,
  masquerAppleId,
  NOM_CALENDRIER_KORA,
  planSynchro,
  prefixeImport,
  texteDe,
} from "./domaine.js";

const ICLOUD = "https://caldav.icloud.com/";

class ErreurIcloud extends Error {}

interface Compte {
  foyer_id: string;
  membre_id: string;
  apple_id: string;
  mot_de_passe: string;
  maison: string;
  calendrier_kora: string;
  ignores: string[];
  liens: { evenementId: string; href: string; etag: string | null; empreinte: string }[];
}

type Acces = { appleId: string; motDePasse: string };

/** Une demande WebDAV à iCloud. */
async function dav(acces: Acces, methode: string, url: string, corps?: string, entetes: Record<string, string> = {}): Promise<Response> {
  const reponse = await fetch(url, {
    method: methode,
    headers: {
      Authorization: `Basic ${btoa(unescape(encodeURIComponent(`${acces.appleId}:${acces.motDePasse}`)))}`,
      ...(corps ? { "Content-Type": methode === "PUT" ? "text/calendar; charset=utf-8" : "application/xml; charset=utf-8" } : {}),
      ...entetes,
    },
    body: corps,
  });
  if (reponse.status === 401 || reponse.status === 403) {
    await reponse.body?.cancel();
    throw new ErreurIcloud("iCloud refuse l'identifiant ou le mot de passe d'app. Crée un nouveau mot de passe d'app et relie à nouveau le compte.");
  }
  return reponse;
}

async function multistatus(acces: Acces, methode: string, url: string, corps: string, profondeur: "0" | "1"): Promise<{ xml: string; base: string }> {
  const r = await dav(acces, methode, url, corps, { Depth: profondeur });
  const xml = await r.text();
  if (r.status !== 207) throw new ErreurIcloud(`iCloud ne répond pas comme prévu (${methode} ${r.status}).`);
  return { xml, base: r.url || url };
}

/** Le dossier des calendriers du compte. */
async function trouverMaison(acces: Acces): Promise<string> {
  const p = await multistatus(acces, "PROPFIND", ICLOUD, CORPS_PRINCIPAL, "0");
  const principal = texteDe(lireMultistatus(p.xml)[0]?.props["current-user-principal"] ?? "", "href");
  if (!principal) throw new ErreurIcloud("Je ne trouve pas le compte dans iCloud.");
  const m = await multistatus(acces, "PROPFIND", new URL(principal, p.base).href, CORPS_MAISON, "0");
  const maison = texteDe(lireMultistatus(m.xml)[0]?.props["calendar-home-set"] ?? "", "href");
  if (!maison) throw new ErreurIcloud("Je ne trouve pas les calendriers de ce compte.");
  const url = new URL(maison, m.base);
  url.port = "";
  return url.href.endsWith("/") ? url.href : `${url.href}/`;
}

async function listerCalendriers(acces: Acces, maison: string) {
  const r = await multistatus(acces, "PROPFIND", maison, CORPS_CALENDRIERS, "1");
  const trouves = lireCalendriers(r.xml, r.base);
  // Un compte iCloud a presque toujours plusieurs calendriers ; sinon, la forme de la réponse va dans les journaux.
  if (trouves.length <= 1) {
    console.log("agenda: calendriers introuvables", JSON.stringify(lireMultistatus(r.xml).map((x) => ({ href: x.href.replace(/^\/\d+\//, "/…/"), props: Object.keys(x.props), type: (x.props.resourcetype ?? "").slice(0, 200), comp: (x.props["supported-calendar-component-set"] ?? "").slice(0, 200) }))), r.xml.length, r.xml.slice(0, 300).replace(/\d{6,}/g, "…"));
  }
  return trouves;
}

async function creerCalendrierKora(acces: Acces, maison: string): Promise<string> {
  const url = `${maison}kora-${crypto.randomUUID()}/`;
  const r = await dav(acces, "MKCALENDAR", url, corpsCreerCalendrier(NOM_CALENDRIER_KORA, COULEUR_KORA));
  await r.body?.cancel();
  if (r.status !== 201) throw new ErreurIcloud(`Impossible de créer le calendrier « Kora » dans iCloud (${r.status}).`);
  return url;
}

/** Le calendrier « Kora » du compte : celui qui existe déjà, ou un nouveau. */
async function calendrierKora(acces: Acces, maison: string): Promise<string> {
  const existant = (await listerCalendriers(acces, maison)).find((c) => c.nom === NOM_CALENDRIER_KORA);
  return existant?.url ?? (await creerCalendrierKora(acces, maison));
}

async function lireCalendrier(acces: Acces, url: string, periode?: { du: string; au: string }) {
  const r = await dav(acces, "REPORT", url, corpsEvenements(periode), { Depth: "1" });
  const xml = await r.text();
  if (r.status === 404) return null;
  if (r.status !== 207) throw new ErreurIcloud(`iCloud ne donne pas les événements (${r.status}).`);
  return lireRessources(xml, r.url || url);
}

/** Les documents « agenda », le foyer et les animaux, tels que les téléphones les ont partagés. */
async function donneesDuFoyer(foyerId: string) {
  const lignes = (await echec(
    serveur.from("documents").select("collection, donnees").eq("foyer_id", foyerId).in("collection", ["agenda", "foyer", "animaux"]).not("donnees", "is", null),
  )) as { collection: string; donnees: any }[];
  const de = (c: string) => lignes.filter((l) => l.collection === c).map((l) => l.donnees);
  return { agenda: de("agenda"), foyer: de("foyer")[0] ?? null, animaux: de("animaux") };
}

async function ecrireDocuments(foyerId: string, documents: { id: string; donnees: unknown }[]) {
  if (!documents.length) return;
  const maj = new Date().toISOString();
  await echec(
    serveur.from("documents").upsert(
      documents.map((d) => ({ foyer_id: foyerId, collection: "agenda", id: d.id, donnees: d.donnees, maj_client: maj })),
      { onConflict: "foyer_id,collection,id" },
    ),
  );
}

/** Synchronise un compte ; renvoie les événements du foyer tels qu'ils sont après. */
async function synchroniserCompte(c: Compte, evenements: any[], foyer: any, animaux: any[], aRetirer: any[]): Promise<any[]> {
  const acces = { appleId: c.apple_id, motDePasse: c.mot_de_passe };
  const maintenant = new Date().toISOString();
  const aujourdhui = aujourdhuiAZurich(new Date());
  let kora = c.calendrier_kora;
  let liens = c.liens ?? [];

  let contenuKora = await lireCalendrier(acces, kora);
  if (contenuKora === null) {
    // Le calendrier « Kora » a été supprimé sur l'iPhone : un nouveau, et tout y est réécrit.
    kora = await calendrierKora(acces, c.maison);
    liens = [];
    contenuKora = (await lireCalendrier(acces, kora)) ?? [];
  }
  const calendriers = await listerCalendriers(acces, c.maison);
  const lus = calendriers.filter((x) => x.url !== kora && x.nom !== NOM_CALENDRIER_KORA && !c.ignores.includes(x.url));
  const periode = { du: decaler(aujourdhui, { unite: "jour", tous: -JOURS_PASSES }), au: decaler(aujourdhui, { unite: "jour", tous: JOURS_A_VENIR }) };
  let autres: any[] | null = [];
  try {
    for (const cal of lus) autres.push(...((await lireCalendrier(acces, cal.url, periode)) ?? []));
  } catch (e) {
    if (e instanceof ErreurIcloud && /refuse/.test(e.message)) throw e;
    console.error("Lecture", (e as Error).message);
    autres = null;
  }

  const plan = planSynchro({ membre: c.membre_id, foyer, evenements, animaux, liens, calendrierKora: kora, kora: contenuKora, autres, aRetirer, maintenant, aujourdhui });

  // Ce qui a été changé ou retiré dans Kora retourne dans son calendrier iCloud.
  for (const href of plan.retirerIcloud) {
    const r = await dav(acces, "DELETE", href);
    await r.body?.cancel();
    if (!r.ok && r.status !== 404) console.error("DELETE", r.status);
  }
  for (const m of plan.modifierIcloud) {
    // If-Match : si l'iPhone l'a changé entre-temps, iCloud refuse (412) et le passage suivant départage.
    const r = await dav(acces, "PUT", m.href, m.ics, m.etag ? { "If-Match": m.etag } : {});
    await r.body?.cancel();
    if (r.ok) plan.ecrire.push({ ...m.evenement, icloud: { href: m.href, etag: r.headers.get("ETag"), importeLe: m.evenement.modifieLe } });
    else console.error("PUT iCloud", r.status);
  }

  for (const href of plan.effacer) {
    const r = await dav(acces, "DELETE", href);
    await r.body?.cancel();
  }
  const nouveauxLiens = [...plan.liens];
  for (const envoi of plan.envoyer) {
    const r = await dav(acces, "PUT", envoi.href, envoi.ics);
    await r.body?.cancel();
    if (r.ok) nouveauxLiens.push({ evenementId: envoi.evenementId, href: envoi.href, etag: r.headers.get("ETag"), empreinte: envoi.empreinte });
    else console.error("PUT", r.status, envoi.evenementId);
  }

  const supprimes = new Set(plan.supprimer);
  const ecrits = new Map(plan.ecrire.map((e: any) => [e.id, e]));
  await ecrireDocuments(c.foyer_id, [
    ...plan.ecrire.map((e: any) => ({ id: e.id, donnees: e })),
    ...plan.supprimer.map((id: string) => ({ id, donnees: null })),
    {
      id: idCompteIcloud(c.membre_id),
      donnees: {
        id: idCompteIcloud(c.membre_id),
        membre: c.membre_id,
        appleId: masquerAppleId(c.apple_id),
        calendriers: calendriers.filter((x) => x.url !== kora && x.nom !== NOM_CALENDRIER_KORA).map((x) => ({ url: x.url, nom: x.nom, lu: !c.ignores.includes(x.url), ...(x.couleur ? { couleur: x.couleur } : {}) })),
        derniereSynchro: maintenant,
        erreur: null,
      },
    },
  ]);
  await echec(serveur.rpc("icloud_maj", { p_foyer_id: c.foyer_id, p_membre_id: c.membre_id, p_liens: nouveauxLiens, p_calendrier_kora: kora }));
  return [...evenements.filter((e) => !supprimes.has(e.id)).map((e) => ecrits.get(e.id) ?? e), ...plan.ecrire.filter((e: any) => !evenements.some((x) => x.id === e.id))];
}

/** Synchronise les comptes d'un foyer l'un après l'autre : le second voit ce que le premier a apporté. */
async function synchroniserFoyer(foyerId: string, comptes: Compte[]): Promise<{ ok: number; erreurs: number }> {
  const d = await donneesDuFoyer(foyerId);
  let evenements = evenementsDe(d.agenda);
  const aRetirer = aRetirerDe(d.agenda);
  const bilan = { ok: 0, erreurs: 0 };
  for (const c of comptes) {
    const pris = await echec(serveur.rpc("icloud_verrou", { p_foyer_id: foyerId, p_membre_id: c.membre_id, p_prendre: true }));
    if (!pris) continue;
    try {
      evenements = await synchroniserCompte(c, evenements, d.foyer, d.animaux, aRetirer);
      bilan.ok++;
    } catch (e) {
      bilan.erreurs++;
      console.error("Synchro", foyerId, c.membre_id, (e as Error).message);
      const ancien = d.agenda.find((x: any) => x.id === idCompteIcloud(c.membre_id));
      await ecrireDocuments(foyerId, [
        {
          id: idCompteIcloud(c.membre_id),
          donnees: {
            id: idCompteIcloud(c.membre_id),
            membre: c.membre_id,
            appleId: masquerAppleId(c.apple_id),
            calendriers: ancien?.calendriers ?? [],
            derniereSynchro: ancien?.derniereSynchro ?? null,
            erreur: e instanceof ErreurIcloud ? e.message : "La synchro avec iCloud n'a pas marché, elle réessaie toute seule.",
          },
        },
      ]).catch(() => {});
    } finally {
      await serveur.rpc("icloud_verrou", { p_foyer_id: foyerId, p_membre_id: c.membre_id, p_prendre: false });
    }
  }
  return bilan;
}

async function comptes(foyerId: string | null): Promise<Compte[]> {
  return (await echec(serveur.rpc("icloud_comptes", { p_foyer_id: foyerId }))) as Compte[];
}

/** Le passage régulier : tous les foyers qui ont relié au moins un compte. */
async function passage() {
  const parFoyer = new Map<string, Compte[]>();
  for (const c of await comptes(null)) parFoyer.set(c.foyer_id, [...(parFoyer.get(c.foyer_id) ?? []), c]);
  const bilan = { ok: 0, erreurs: 0 };
  for (const [foyerId, liste] of parFoyer) {
    const b = await synchroniserFoyer(foyerId, liste);
    bilan.ok += b.ok;
    bilan.erreurs += b.erreurs;
  }
  return bilan;
}

const texte = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  try {
    const corps = await req.json().catch(() => ({}));

    const cleCron = req.headers.get("x-cle-cron");
    if (cleCron) {
      if (!(await cleCronValide(cleCron))) return repondre({ erreur: "Clé inconnue" }, 401);
      return repondre(await passage());
    }

    const user = await utilisateur(req);
    if (!user) return repondre({ erreur: "Connexion requise" }, 401);
    const foyerId = texte(corps.foyerId, 100);
    const membreId = texte(corps.membreId, 100);
    if (!foyerId) return repondre({ erreur: "Demande inconnue" }, 400);
    if (!(await estMembre(foyerId, user.id))) return repondre({ erreur: "Ce foyer appartient à un autre compte" }, 403);

    if (corps.mode === "synchroniser") return repondre(await synchroniserFoyer(foyerId, await comptes(foyerId)));
    if (!membreId) return repondre({ erreur: "Demande inconnue" }, 400);

    if (corps.mode === "relier") {
      const appleId = texte(corps.appleId, 200);
      // Un mot de passe d'app s'affiche « abcd-efgh-ijkl-mnop » ; les espaces copiés ne comptent pas.
      const motDePasse = texte(corps.motDePasse, 100).replace(/\s/g, "");
      if (!appleId || !motDePasse) return repondre({ erreur: "Il manque l'identifiant Apple ou le mot de passe d'app." }, 400);
      const acces = { appleId, motDePasse };
      const maison = await trouverMaison(acces);
      const kora = await calendrierKora(acces, maison);
      await echec(serveur.rpc("icloud_enregistrer", { p_foyer_id: foyerId, p_membre_id: membreId, p_apple_id: appleId, p_mot_de_passe: motDePasse, p_maison: maison, p_calendrier_kora: kora }));
      return repondre(await synchroniserFoyer(foyerId, (await comptes(foyerId)).filter((c) => c.membre_id === membreId)));
    }

    if (corps.mode === "choisir") {
      const ignores = Array.isArray(corps.ignores) ? corps.ignores.filter((u: unknown) => typeof u === "string").slice(0, 50) : [];
      await echec(serveur.rpc("icloud_maj", { p_foyer_id: foyerId, p_membre_id: membreId, p_ignores: ignores }));
      return repondre(await synchroniserFoyer(foyerId, (await comptes(foyerId)).filter((c) => c.membre_id === membreId)));
    }

    if (corps.mode === "delier") {
      await echec(serveur.rpc("icloud_retirer", { p_foyer_id: foyerId, p_membre_id: membreId }));
      // Ce qui venait de ce compte quitte Kora ; le calendrier « Kora » reste sur l'iPhone, à supprimer à la main.
      const d = await donneesDuFoyer(foyerId);
      const prefixe = prefixeImport(membreId);
      await ecrireDocuments(foyerId, [
        ...d.agenda.filter((x: any) => typeof x.id === "string" && x.id.startsWith(prefixe)).map((x: any) => ({ id: x.id, donnees: null })),
        { id: idCompteIcloud(membreId), donnees: null },
      ]);
      return repondre({ ok: true });
    }

    return repondre({ erreur: "Demande inconnue" }, 400);
  } catch (e) {
    console.error(e);
    if (e instanceof ErreurIcloud) return repondre({ erreur: e.message }, 502);
    return repondre({ erreur: messageErreur(e) }, 500);
  }
});
