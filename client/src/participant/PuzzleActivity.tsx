import { useState } from "react";

export default function PuzzleActivity({
  instruction,
  onSubmit,
}: {
  instruction: string;
  onSubmit: (score: number) => void;
}) {
  const [value, setValue] = useState("");

  return (
    <div style={{ padding: 30 }}>
      <h2>Puzzle Activity</h2>

      <p>{instruction}</p>

      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="How many fragments correct?"
      />

      <button onClick={() => onSubmit(Number(value))}>
        Submit result
      </button>
    </div>
  );
}