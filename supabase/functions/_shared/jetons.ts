// Code commun des fonctions serveur : les jetons des raccourcis (Siri, Apple Pay).
// Le serveur ne garde que l'empreinte SHA-256 d'un jeton, jamais le jeton lui-même.

export async function empreinte(jeton: string): Promise<string> {
  const octets = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(jeton)));
  return [...octets].map((o) => o.toString(16).padStart(2, "0")).join("");
}

/** Un nouveau jeton, lisible dans une adresse (base64 « url »). */
export function nouveauJeton(): string {
  const octets = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...octets)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
