// Le lien d'un raccourci de l'iPhone (Siri, Apple Pay) : l'adresse de la fonction serveur et la clé
// de cette personne. Jusqu'en 0.0.82, la clé partait dans l'adresse (« ?j=… ») et finissait dans
// les journaux du serveur ; depuis 0.0.84 elle part dans le corps de la demande (champ « jeton »).
// Le serveur accepte encore l'ancienne forme, pour les raccourcis déjà faits.

/** L'adresse sans la clé, et la clé seule (null si le lien n'en porte pas). */
export function separerLien(lien: string): { adresse: string; jeton: string | null } {
  const [adresse, requete = ""] = lien.split("?");
  const jeton = new URLSearchParams(requete).get("j");
  return { adresse, jeton: jeton || null };
}

/** La ligne du corps JSON qui porte la clé, à mettre dans la demande copiée. */
export function champJeton(jeton: string | null): string[] {
  return jeton ? [`- Dans le corps JSON, un champ de type Texte : jeton = ${jeton}`] : [];
}

/** L'avertissement à dire avec la demande : la clé donne l'accès au foyer. */
export const AVERTISSEMENT_RACCOURCI = "Ce raccourci contient ta clé personnelle : ne le partage avec personne. Si c'est arrivé, retire le lien et recrée-le.";
