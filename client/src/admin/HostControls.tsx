export default function HostControls({
  canStart,
  starting,
  onStart,
}: {
  canStart: boolean;
  starting: boolean;
  onStart: () => void;
}) {
  return (
    <div>
      <h3>Host controls</h3>

      <button disabled={!canStart || starting} onClick={onStart}>
        {starting ? "Starting…" : "Start session"}
      </button>

      <button>Next activity</button>

      <button>Pause timer</button>

      <button>End session</button>
    </div>
  );
}