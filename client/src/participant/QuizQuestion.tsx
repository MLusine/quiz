import { useState } from "react";

type Props = {
  question: string;
  options: string[];
  timeLeft: number;
  onAnswer: (index: number) => void;
};

export default function QuizQuestion({
  question,
  options,
  timeLeft,
  onAnswer,
}: Props) {
  const [locked, setLocked] = useState(false);

  const answer = (i: number) => {
    if (locked) return;
    setLocked(true);
    onAnswer(i);
  };

  return (
    <div style={{ padding: 30 }}>
      <h2>{question}</h2>

      <p>Time left: {timeLeft}</p>

      <div style={{ display: "grid", gap: 10 }}>
        {options.map((o, i) => (
          <button
            key={i}
            disabled={locked}
            onClick={() => answer(i)}
            style={{ padding: 12 }}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}