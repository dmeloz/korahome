import type { SupabaseClient } from "@supabase/supabase-js";
import { COLLECTIONS_SYNCHRO, type Changement, type CollectionSynchro } from "../domaine/synchro";
import type { FoyerPartage, ReponseJarvis, ServicesDistants } from "./distant";

// Le serveur partagé du foyer, sur Supabase (tables et règles : supabase/schema.sql).
// La bibliothèque n'est chargée qu'au premier usage, pour garder le démarrage rapide.

const PAGE = 1000;

interface LigneDocument {
  collection: CollectionSynchro;
  id: string;
  donnees: unknown;
  maj_client: string;
  maj_serveur: string;
}

/** Messages du serveur traduits pour l'écran Partage. */
export function traduireErreur(message: string): string {
  if (/fetch|network|load failed/i.test(message)) return "Pas de connexion au serveur.";
  if (/invalid login credentials/i.test(message)) return "Adresse ou mot de passe incorrect.";
  if (/already registered|already exists/i.test(message)) return "Ce compte existe déjà : connecte-toi.";
  if (/password should be|weak password/i.test(message)) return "Mot de passe trop court ou trop simple.";
  if (/email not confirmed/i.test(message)) return "Adresse pas encore confirmée : désactive « Confirm email » dans Supabase.";
  if (/anonymous sign-ins are disabled/i.test(message)) return "L'entrée par code n'est pas encore activée sur le serveur.";
  if (/Trop d'essais/i.test(message)) return "Trop d'essais : réessaie dans une heure.";
  if (/rate limit|security purposes/i.test(message)) return "Trop de demandes, réessaie dans une minute.";
  if (/email.*invalid|invalid.*email/i.test(message)) return "Adresse e-mail invalide.";
  if (/JWT|not authenticated|Connexion requise/i.test(message)) return "Reconnecte-toi pour continuer.";
  if (/autre compte/i.test(message)) return "Ce téléphone n'est pas relié à ce foyer : vérifie le partage.";
  return message;
}

function echec(erreur: { message: string } | null): void {
  if (erreur) throw new Error(traduireErreur(erreur.message));
}

/** Le partage n'est actif que si l'app a été construite avec l'adresse et la clé du projet. */
export function configurationSupabase(): { url: string; cle: string } | null {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const cle = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return url && cle ? { url, cle } : null;
}

/** Une fonction serveur (rappels, jarvis) ; ses messages d'erreur sont déjà en français. */
async function appelerFonction(sb: SupabaseClient, nom: "rappels" | "jarvis", corps: object): Promise<Record<string, unknown>> {
  const { data, error } = await sb.functions.invoke(nom, { body: corps });
  if (error) {
    const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(traduireErreur(detail?.erreur ?? error.message));
  }
  return data as Record<string, unknown>;
}

export function creerServicesSupabase(url: string, cle: string): ServicesDistants {
  let client: Promise<SupabaseClient> | null = null;
  const supabase = () =>
    (client ??= import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(url, cle, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "korahome.session" } }),
    ));

  return {
    async connecte() {
      const { data } = await (await supabase()).auth.getSession();
      const utilisateur = data.session?.user;
      return utilisateur ? { email: utilisateur.is_anonymous ? null : (utilisateur.email ?? null) } : null;
    },
    async entrerSansCompte() {
      const { error } = await (await supabase()).auth.signInAnonymously();
      echec(error);
    },
    async creerCompte(email, motDePasse) {
      const { data, error } = await (await supabase()).auth.signUp({ email, password: motDePasse });
      echec(error);
      // Sans session, le projet demande encore une confirmation par e-mail (réglage « Confirm email »).
      if (!data.session) throw new Error("Le compte attend une confirmation par e-mail : désactive « Confirm email » dans Supabase.");
    },
    async connecter(email, motDePasse) {
      const { error } = await (await supabase()).auth.signInWithPassword({ email, password: motDePasse });
      echec(error);
    },
    async deconnecter() {
      const sb = await supabase();
      // Sans compte, la session ne se retrouvera pas : le téléphone quitte d'abord le foyer
      // (le code permettra de revenir), pour ne pas laisser un membre fantôme.
      const utilisateur = (await sb.auth.getSession()).data.session?.user;
      if (utilisateur?.is_anonymous) echec((await sb.from("membres_foyer").delete().eq("user_id", utilisateur.id)).error);
      // « local » : déconnecte ce téléphone seulement.
      const { error } = await sb.auth.signOut({ scope: "local" });
      echec(error);
    },

    async mesFoyers() {
      const { data, error } = await (await supabase()).from("foyers").select("id, nom, code").order("cree_le");
      echec(error);
      return (data ?? []) as FoyerPartage[];
    },
    async creerFoyer(id, nom) {
      const { data, error } = await (await supabase()).rpc("creer_foyer", { p_id: id, p_nom: nom });
      echec(error);
      return (data as FoyerPartage[])[0];
    },
    async rejoindreFoyer(code) {
      const { data, error } = await (await supabase()).rpc("rejoindre_foyer", { p_code: code });
      echec(error);
      if (!data) throw new Error("Code inconnu : vérifie-le sur l'autre iPhone.");
      return data as string;
    },

    async lire(foyerId, depuis) {
      const sb = await supabase();
      const changements: Changement[] = [];
      let curseur: string | null = null;
      for (let debut = 0; ; debut += PAGE) {
        let requete = sb
          .from("documents")
          .select("collection, id, donnees, maj_client, maj_serveur")
          .eq("foyer_id", foyerId)
          .order("maj_serveur")
          .range(debut, debut + PAGE - 1);
        if (depuis) requete = requete.gt("maj_serveur", depuis);
        const { data, error } = await requete;
        echec(error);
        const lignes = (data ?? []) as LigneDocument[];
        for (const l of lignes) {
          if (!COLLECTIONS_SYNCHRO.includes(l.collection)) continue;
          // Même écriture que sur le téléphone (« …Z »), pour comparer les heures entre elles.
          changements.push({ collection: l.collection, id: l.id, donnees: l.donnees, maj: new Date(l.maj_client).toISOString() });
          curseur = l.maj_serveur;
        }
        if (lignes.length < PAGE) break;
      }
      return { changements, curseur };
    },

    async cleRappels() {
      return (await appelerFonction(await supabase(), "rappels", { mode: "cle" })).cle as string;
    },
    async inscrireRappels(i) {
      const { error } = await (await supabase()).rpc("enregistrer_abonnement", {
        p_endpoint: i.endpoint,
        p_foyer_id: i.foyerId,
        p_membre_id: i.membreId,
        p_cles: i.cles,
        p_preferences: { taches: i.preferences.taches, mitsu: i.preferences.mitsu, stock: i.preferences.stock, jours: i.preferences.jours },
        p_heure: i.preferences.heure,
      });
      echec(error);
    },
    async desinscrireRappels(endpoint) {
      echec((await (await supabase()).rpc("retirer_abonnement", { p_endpoint: endpoint })).error);
    },
    async essaiRappel(endpoint) {
      await appelerFonction(await supabase(), "rappels", { mode: "essai", endpoint });
    },

    async demanderJarvis(demande) {
      return (await appelerFonction(await supabase(), "jarvis", demande)) as unknown as ReponseJarvis;
    },

    async envoyer(foyerId, changements) {
      const sb = await supabase();
      for (let debut = 0; debut < changements.length; debut += PAGE / 2) {
        const lignes = changements.slice(debut, debut + PAGE / 2).map((c) => ({
          foyer_id: foyerId,
          collection: c.collection,
          id: c.id,
          donnees: c.donnees,
          maj_client: c.maj,
        }));
        const { error } = await sb.from("documents").upsert(lignes, { onConflict: "foyer_id,collection,id" });
        echec(error);
      }
    },
  };
}
