// Code commun des fonctions serveur : l'horloge et les identifiants que les règles reçoivent (Contexte).

/** Le contexte des règles, côté serveur. */
export const ctx = { maintenant: () => new Date().toISOString(), nouvelId: () => crypto.randomUUID() };

/** Le jour à Renens (Europe/Zurich), « AAAA-MM-JJ ». */
export const aujourdhui = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(new Date());
