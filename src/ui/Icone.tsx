const TRACES = {
  maison: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  liste: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
  coche: "M4 12.5 9 17.5 20 6.5",
  calendrier: "M4 6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 10h16M8 3v4M16 3v4",
  panier: "M3 5h2l2.4 10.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2M9.5 20h.01M17 20h.01",
  chat: "M5 20v-9l-1-6 4 3h8l4-3-1 6v9zM9.5 13h.01M14.5 13h.01",
  frigo: "M6 3h12v18H6zM6 10h12M9 6v2M9 13v3",
  feuille: "M5 19c0-8 5-14 15-15-1 10-7 15-15 15zM5 19l7-7",
  retour: "M15 5l-7 7 7 7",
  reglages: "M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6",
  haut: "M6 15l6-6 6 6",
  bas: "M6 9l6 6 6-6",
  moins: "M6 12h12",
  ajouter: "M12 5v14M5 12h14",
  suivant: "M9 5l7 7-7 7",
  cloche: "M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0",
  partage: "M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01",
  note: "M5 4h10l4 4v12H5zM14 4v5h5M8 13h8M8 17h5",
  pastilleDev: "M7 8h10a4 4 0 0 1 0 8H7a4 4 0 0 1 0-8zM8.5 12h.01",
  agrandir: "M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7",
  reduire: "M4 14h6v6M20 10h-6V4M10 14l-7 7M14 10l7-7",
  jarvis: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z",
  micro: "M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3",
  envoyer: "M12 19V5M6 11l6-6 6 6",
  outil: "M14.7 6.3a4 4 0 0 0-5.2 5.2L4 17l3 3 5.5-5.5a4 4 0 0 0 5.2-5.2l-2.6 2.6-2.4-.6-.6-2.4z",
  arreter: "M7 7h10v10H7z",
  photo: "M4 8a1 1 0 0 1 1-1h3l1.5-2h5L16 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  cadenas: "M7.5 11V8a4.5 4.5 0 0 1 9 0v3M6 11h12v9H6zM12 15v2",
  appris: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z",
  fermer: "M6 6l12 12M18 6 6 18",
  codeBarres: "M3 7V4h3M18 4h3v3M21 17v3h-3M6 20H3v-3M7 8v8M10 8v8M13 8v8M15.5 8v8M17.5 8v8",
  ticket: "M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21zM9 8h6M9 12h6M9 16h4",
  toque: "M7 20h10M7.5 16h9l.5 4H7zM7.5 16 6.6 12A3.5 3.5 0 0 1 9 5.6a3.5 3.5 0 0 1 6 0 3.5 3.5 0 0 1 2.4 6.4l-.9 4",
  coeur: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  loupe: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  portefeuille: "M4 7a2 2 0 0 1 2-2h11v4M4 7v11a2 2 0 0 0 2 2h14V9H6a2 2 0 0 1-2-2zM16 14.5h.01",
  dossier: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  sauvegarde: "M12 4v10M8 10l4 4 4-4M5 19h14",
  actualiser: "M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9M18.5 3v4.2h-4.2M5.5 21v-4.2h4.2",
  deplacer: "M4 12h16M15 7l5 5-5 5",
  soleil: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  nuage: "M7 18a4 4 0 1 1 .9-7.9A6 6 0 0 1 19 12a3 3 0 0 1-1 6z",
  lune: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z",
  eclair: "M13 3 5 13h6l-1 8 8-10h-6z",
  pluie: "M7 15a4 4 0 1 1 .9-7.9A6 6 0 0 1 19 9a3 3 0 0 1-1 6zM8 18l-1 3M12 18l-1 3M16 18l-1 3",
  vague: "M3 10c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0",
  thermometre: "M14 14.8V4.5a2 2 0 0 0-4 0v10.3a4 4 0 1 0 4 0zM12 17.5v-6",
  sourire: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 14a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01",
  sablier: "M7 3h10M7 21h10M8 3c0 4.5 8 5 8 9s-8 4.5-8 9M16 3c0 4.5-8 5-8 9s8 4.5 8 9",
} as const;

export type NomIcone = keyof typeof TRACES;

export function Icone({ nom, taille }: { nom: NomIcone; taille?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={taille}
      height={taille}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={TRACES[nom]} />
    </svg>
  );
}

/** Les humeurs en pictogrammes au trait, dans le style de l'app (pas d'emoji). */
export const PICTO_HUMEUR: Record<string, NomIcone> = {
  "😊": "sourire",
  "🥰": "coeur",
  "😌": "vague",
  "🎉": "soleil",
  "😴": "lune",
  "😤": "eclair",
  "🤯": "pluie",
  "🤒": "thermometre",
};

/** Le petit dessin d'un temps (code WMO d'Open-Meteo). */
export function pictoMeteo(code: number): NomIcone {
  if (code >= 95) return "eclair";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "pluie";
  if (code <= 1) return "soleil";
  return "nuage";
}
