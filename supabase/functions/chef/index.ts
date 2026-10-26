// KoraHome : le Chef de la semaine (Supabase Edge Function, Deno).
//
// - Chaque heure, le serveur l'appelle (pg_cron, voir supabase/schema.sql) avec sa clé
//   « x-cle-cron » : le Chef passe pour chaque foyer qui l'a activé, au jour et à l'heure
//   choisis dans l'app (par défaut le dimanche à 17 h, à Zurich), une fois par jour.
// - Un téléphone l'appelle avec sa session (« maintenant ») pour le lancer tout de suite.
//
// Il lit le stock, la liste de courses et Mitsu, demande les menus à Claude (réponse au format
// imposé), puis écrit lui-même les menus et les recettes ; ce qui manque attend que le foyer valide un soir ou le menu (depuis 0.0.70), marqué
// « chef », et les menus dans la collection « menus », avec la recette de chaque repas
// (ingrédients et étapes) rangée dans les recettes du foyer, même collection. Il n'écrit rien d'autre ; relancé,
// il remplace seulement ses propres articles pas encore cochés. Sa dépense compte dans le
// plafond de Jarvis (5 CHF par mois). Les téléphones du foyer reçoivent une notification.
//
// Les règles viennent de src/domaine/chef.ts, copié dans domaine.js par `npm run fonction`.
// Déploiement : docs/chef.md.

import Anthropic from "npm:@anthropic-ai/sdk";
import webpush from "npm:web-push@3.6.7";
import { ctx } from "../_shared/contexte.ts";
import { avecAlerte, PanneSignalee } from "../_shared/alerte.ts";
import { ErreurPublique, limiteDuCompte, messageErreur, preflight, repondre } from "../_shared/http.ts";
import { cleCronValide, echec, estMembre, serveur, utilisateur } from "../_shared/supabase.ts";
import {
  articlesARemplacer,
  CONSIGNES_CHEF,
  coutChef,
  estLHeureDuChef,
  etatBudget,
  idMenu,
  jourEtHeure,
  lireProposition,
  menuDeLaSemaine,
  messageChef,
  MODELE_CHEF,
  moisDe,
  NOMBRE_REPAS,
  noteServeur,
  notificationChef,
  nouveauMenu,
  phrasePanne,
  recettesDe,
  recettesDuChef,
  reglageChef,
  SCHEMA_CHEF,
  tirerSemaine,
} from "./domaine.js";

/** Ajoute une dépense au compteur de Jarvis et renvoie le total du mois (0 : simple lecture). */
async function compter(foyerId: string, microChf: number): Promise<number> {
  const mois = moisDe(jourEtHeure(new Date()).jour);
  return Number(await echec(serveur.rpc("jarvis_compter", { p_foyer_id: foyerId, p_mois: mois, p_micro_chf: microChf })));
}

/** Ce que le Chef lit : la liste de courses, le stock, Mitsu, ses propres menus et la mémoire du foyer (les goûts). */
async function donneesDuFoyer(foyerId: string) {
  const lignes = (await echec(
    serveur
      .from("documents")
      .select("collection, donnees")
      .eq("foyer_id", foyerId)
      .in("collection", ["listes", "elements", "stock", "animaux", "menus", "memoire"])
      .not("donnees", "is", null),
  )) as { collection: string; donnees: any }[];
  const de = (c: string) => lignes.filter((l) => l.collection === c).map((l) => l.donnees);
  return { listes: de("listes"), elements: de("elements"), produits: de("stock"), animaux: de("animaux"), menus: de("menus"), souvenirs: de("memoire") };
}

/** Annonce les menus aux téléphones du foyer inscrits aux notifications. */
async function annoncer(foyerId: string, message: { titre: string; corps: string }) {
  const [r] = await echec(serveur.rpc("reglages_push"));
  if (!r?.vapid_publique) return 0;
  const abonnements = (await echec(serveur.from("abonnements_push").select("endpoint, cles").eq("foyer_id", foyerId))) as { endpoint: string; cles: { p256dh: string; auth: string } }[];
  let envoyes = 0;
  for (const a of abonnements) {
    try {
      await webpush.sendNotification(
        { endpoint: a.endpoint, keys: a.cles },
        JSON.stringify({ ...message, nombre: 0, url: "./" }),
        { vapidDetails: { subject: "https://dmeloz.github.io/korahome/", publicKey: r.vapid_publique, privateKey: r.vapid_privee }, TTL: 4 * 3600, urgency: "normal" },
      );
      envoyes++;
    } catch (e) {
      // Un téléphone qui a retiré l'autorisation est oublié par la fonction des rappels.
      console.error("Envoi impossible", (e as { statusCode?: number }).statusCode, (e as Error).message);
    }
  }
  return envoyes;
}

class PlafondAtteint extends ErreurPublique {}

/** Le passage du Chef pour un foyer : menus, ajouts aux courses, notification. */
async function cuisiner(foyerId: string, lance: "auto" | "maintenant") {
  const cle = Deno.env.get("ANTHROPIC_API_KEY");
  if (!cle) throw new ErreurPublique("Le Chef n'est pas encore branché : sa clé manque sur le serveur.");
  if (etatBudget(await compter(foyerId, 0)).atteint) throw new PlafondAtteint("Le plafond de Jarvis est atteint ce mois-ci : le Chef reprend le 1er du mois prochain.");

  const aujourdhui = jourEtHeure(new Date()).jour;
  const d = await donneesDuFoyer(foyerId);
  const courses = d.listes.find((l: { type?: string }) => l.type === "courses") ?? null;
  const enCourses = courses ? d.elements.filter((e: { listeId: string; coche: boolean }) => e.listeId === courses.id && !e.coche) : [];

  // Kora tire la trame des soirs ; le Chef compose dessus (voir src/domaine/variete.ts).
  const menusPasses = d.menus.filter((m: { type?: string }) => m.type === "menu");
  const trame = tirerSemaine({ menus: menusPasses, aujourdhui, nombre: NOMBRE_REPAS, hasard: Math.random });
  const client = new Anthropic({ apiKey: cle });
  const reponse = await avecAlerte(foyerId, "Le Chef", noteServeur, () => client.messages.create({
    model: MODELE_CHEF,
    max_tokens: 8000,
    system: CONSIGNES_CHEF,
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA_CHEF } },
    messages: [{ role: "user", content: messageChef({ produits: d.produits, enCourses, aujourdhui, souvenirs: d.souvenirs, recettes: recettesDe(d.menus), trame }) }],
  }));
  const budget = etatBudget(await compter(foyerId, coutChef(reponse.usage)));
  if (reponse.stop_reason === "refusal") throw new ErreurPublique("Le Chef n'a pas pu préparer les menus cette fois.");
  const texte = reponse.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const proposition = lireProposition(JSON.parse(texte));
  if (!proposition) throw new ErreurPublique("Le Chef n'a pas proposé de repas, réessaie.");

  // Relancé dans la semaine : il retire d'abord ses propres articles encore à prendre.
  const ancien = menuDeLaSemaine(d.menus, aujourdhui);
  const aRetirer = new Set(articlesARemplacer(ancien, d.elements));
  // Depuis Kora 0.0.70, rien ne part aux courses avant que le foyer valide un soir ou le menu.
  const { repas, recettes } = recettesDuChef(proposition, d.menus, ctx);
  const menu = nouveauMenu({ proposition, repas, produits: d.produits, animaux: d.animaux, aujourdhui, lance, trame }, ctx);

  const maj = new Date().toISOString();
  const lignes = [
    ...[...aRetirer].map((id) => ({ foyer_id: foyerId, collection: "elements", id, donnees: null, maj_client: maj })),
    // Un ancien menu d'un autre jour de la semaine laisse sa place.
    ...(ancien && ancien.id !== menu.id ? [{ foyer_id: foyerId, collection: "menus", id: ancien.id, donnees: null, maj_client: maj }] : []),
    ...recettes.map((r) => ({ foyer_id: foyerId, collection: "menus", id: r.id, donnees: r, maj_client: maj })),
    { foyer_id: foyerId, collection: "menus", id: menu.id, donnees: menu, maj_client: maj },
  ];
  await echec(serveur.from("documents").upsert(lignes, { onConflict: "foyer_id,collection,id" }));
  const envoyes = await annoncer(foyerId, notificationChef(menu)).catch((e) => (console.error("Notification", (e as Error).message), 0));
  return { menu, budget, envoyes, sansListe: !courses };
}

/** Le passage de chaque heure : les foyers dont c'est l'heure, sans menu préparé aujourd'hui. */
async function passageDeLHeure() {
  const reglages = (await echec(
    serveur.from("documents").select("foyer_id, donnees").eq("collection", "menus").eq("id", "reglage").not("donnees", "is", null),
  )) as { foyer_id: string; donnees: unknown }[];
  const maintenant = new Date();
  const aujourdhui = jourEtHeure(maintenant).jour;
  const bilan: Record<string, number> = {};
  for (const r of reglages) {
    if (!estLHeureDuChef(maintenant, reglageChef([r.donnees]))) continue;
    const { data: deja } = await serveur.from("documents").select("id").eq("foyer_id", r.foyer_id).eq("collection", "menus").eq("id", idMenu(aujourdhui)).not("donnees", "is", null).maybeSingle();
    if (deja) {
      bilan.deja = (bilan.deja ?? 0) + 1;
      continue;
    }
    try {
      await cuisiner(r.foyer_id, "auto");
      bilan.prepare = (bilan.prepare ?? 0) + 1;
    } catch (e) {
      console.error("Chef", r.foyer_id, (e as Error).message);
      bilan.erreur = (bilan.erreur ?? 0) + 1;
    }
  }
  return bilan;
}

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  try {
    const corps = await req.json().catch(() => ({}));

    const cleCron = req.headers.get("x-cle-cron");
    if (cleCron) {
      if (!(await cleCronValide(cleCron))) return repondre({ erreur: "Clé inconnue" }, 401);
      return repondre(await passageDeLHeure());
    }

    const user = await utilisateur(req);
    if (!user) return repondre({ erreur: "Connexion requise" }, 401);
    const foyerId = typeof corps.foyerId === "string" ? corps.foyerId.slice(0, 100) : "";
    if (corps.mode !== "maintenant" || !foyerId) return repondre({ erreur: "Demande inconnue" }, 400);
    if (!(await estMembre(foyerId, user.id))) return repondre({ erreur: "Ce foyer appartient à un autre compte" }, 403);
    const { menu, budget, sansListe } = await cuisiner(foyerId, "maintenant");
    return repondre({ menu, budget, sansListe });
  } catch (e) {
    console.error(e);
    if (e instanceof PlafondAtteint) return repondre({ erreur: e.message }, 402);
    const limite = limiteDuCompte(e, "Le Chef");
    if (limite) return repondre({ erreur: limite }, 503);
    if (e instanceof PanneSignalee) return repondre({ erreur: phrasePanne("Le Chef") }, 502);
    if (e instanceof Anthropic.RateLimitError) return repondre({ erreur: "Le Chef est très demandé, réessaie dans un instant." }, 429);
    if (e instanceof Anthropic.AuthenticationError) return repondre({ erreur: "La clé du Chef est refusée : il faut la remplacer sur le serveur." }, 503);
    if (e instanceof Anthropic.APIError) return repondre({ erreur: "Le Chef ne répond pas pour l'instant, réessaie." }, 502);
    return repondre({ erreur: messageErreur(e) }, 500);
  }
});
