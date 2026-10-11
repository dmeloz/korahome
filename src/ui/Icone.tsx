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
  cadenas: "M7.5 11V8a4.5 4.5 0 0 1 9 0v3M6 11h12v9H6zM12 15v2",
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
