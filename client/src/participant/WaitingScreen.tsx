export default function WaitingScreen({ name }: { name: string }) {
  return (
    <div style={{ textAlign: "center", padding: 40 }}>
      <h1>Waiting for host…</h1>
      <p>Welcome {name}</p>
      <p>When the host starts the quiz the screen will update automatically.</p>
    </div>
  );
}