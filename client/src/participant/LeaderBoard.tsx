type Player = {
  name: string;
  score: number;
};

export default function Leaderboard({
  players,
  myRank,
}: {
  players: Player[];
  myRank: number;
}) {
  return (
    <div style={{ padding: 30 }}>
      <h2>Leaderboard</h2>

      <ol>
        {players.slice(0, 5).map((p, i) => (
          <li key={i}>
            {p.name} — {p.score}
          </li>
        ))}
      </ol>

      <p>Your rank: {myRank}</p>
    </div>
  );
}