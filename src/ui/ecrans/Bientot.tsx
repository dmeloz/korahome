export function Bientot({ titre, icone, texte }: { titre: string; icone: string; texte: string }) {
  return (
    <main>
      <h1>{titre}</h1>
      <div className="carte bientot">
        <div className="logo" aria-hidden>{icone}</div>
        <p>{texte}</p>
        <p className="discret">Arrive dans une prochaine version.</p>
      </div>
    </main>
  );
}
