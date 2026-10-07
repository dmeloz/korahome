const TRACES = {
  maison: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  liste: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
  coche: "M4 12.5 9 17.5 20 6.5",
  calendrier: "M4 6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 10h16M8 3v4M16 3v4",
  plus: "M5 12h.01M12 12h.01M19 12h.01",
} as const;

export type NomIcone = keyof typeof TRACES;

export function Icone({ nom }: { nom: NomIcone }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={nom === "plus" ? 3 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={TRACES[nom]} />
    </svg>
  );
}
