import { useState, useEffect } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:4000", {
  transports: ["websocket", "polling"],
});

type JoinSuccess = {
  participantId: number;
  sessionId: number;
  sessionCode: string;
  displayName: string;
};

export type Question = {
  id: string;
  text: string;
  options: string[];
  correct_index?: number;
  timer_seconds: number;
};

export type ActiveQuestion = {
  activityIndex: number;
  questionIndex: number;
  question: Question;
  timer_seconds: number;
  endsAt: number;
};
type LeaderboardItem = {
  rank: number;
  name: string;
  score: number;
};

export default function ParticipantApp() {
  const [code, setCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [suffix, setSuffix] = useState("");
  const [needsSuffix, setNeedsSuffix] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState<JoinSuccess | null>(null);

  const [quizStarted, setQuizStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<ActiveQuestion | null>(
    null,
  );
  const [timeLeft, setTimeLeft] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showCorrect, setShowCorrect] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);

  // Join participant API
  async function joinParticipant(payload: {
    code: string;
    firstName: string;
    lastName: string;
    displayName?: string;
  }): Promise<JoinSuccess> {
    const res = await fetch("/api/participant/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
    } & Partial<JoinSuccess>;
    if (!res.ok) throw new Error(data.error ?? "UNKNOWN");
    return data as JoinSuccess;
  }

  // Timer for current question
  useEffect(() => {
    if (!currentQuestion) return;

    const updateTimer = () => {
      const remaining = Math.ceil((currentQuestion.endsAt - Date.now()) / 1000);
      setTimeLeft(Math.max(0, remaining));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 250);

    return () => clearInterval(interval);
  }, [currentQuestion]);

  // Listen to socket events after joining
  useEffect(() => {
    if (!joined) return;

    socket.emit("participant:joinLobby", {
      sessionCode: joined.sessionCode,
      participant: {
        id: joined.participantId, // or joined.participantId if you have it
        name: joined.displayName,
      },
    });
      console.log("joined sessionCode",joined.sessionCode)

    socket.on("question:start", (data: ActiveQuestion) => {
        console.log("Participant received question:", data);

      setQuizStarted(true); // start the quiz
      setCurrentQuestion(data);
      setSelectedAnswer(null);
      setShowCorrect(false);
    });

    socket.on(
      "question:ended",
      (data: { correctIndex: number; leaderboard: LeaderboardItem[] }) => {
        setShowCorrect(true);
        setLeaderboard(data.leaderboard);
      },
    );

    return () => {
      socket.off("session:started");
      socket.off("question:start");
      socket.off("question:ended");
    };
  }, [joined]);

  function handleAnswerClick(idx: number) {
    if (!currentQuestion || selectedAnswer !== null || !joined) return;

    setSelectedAnswer(idx);

    socket.emit("participant:answer", {
      sessionId: joined.sessionId,
      questionId: currentQuestion.question.id,
      answerIndex: idx,
    });
  }

  // Join form submit
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const displayName =
        needsSuffix && suffix.trim().length > 0
          ? `${firstName.trim()} ${lastName.trim()} ${suffix.trim()}`
          : undefined;

      const result = await joinParticipant({
        code,
        firstName,
        lastName,
        displayName,
      });
      setJoined(result);
    } catch (err) {
      const message = (err as Error).message;
      if (message === "ROOM_FULL") setError("This room is full.");
      else if (message === "DUPLICATE_NAME") {
        setNeedsSuffix(true);
        setError(
          "Someone is already using that name. Add a middle name or suffix.",
        );
      } else if (message === "SESSION_NOT_FOUND")
        setError("No active session found.");
      else setError("Could not join the session. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (joined && !quizStarted) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
          textAlign: "center",
        }}
      >
        <h1>Waiting for host…</h1>
        <p>
          Welcome, <strong>{joined.displayName}</strong>.
        </p>
        <p>
          Keep this screen open. When the host starts, your view will update
          with questions and timers.
        </p>
        <div>
          Room code: <strong>{joined.sessionCode}</strong>
        </div>
      </div>
    );
  }

  if (quizStarted && currentQuestion) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Quiz started!</h1>
        <div style={{ marginTop: 24 }}>
          <h2>{currentQuestion.question.text}</h2>
          <p>Time left: {timeLeft}s</p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginTop: 12,
            }}
          >
            {currentQuestion.question.options.map((opt, idx) => (
              <button
                key={idx}
                disabled={selectedAnswer !== null}
                onClick={() => handleAnswerClick(idx)}
                style={{
                  padding: 12,
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  backgroundColor:
                    showCorrect &&
                    currentQuestion.question.correct_index === idx
                      ? "lightgreen"
                      : selectedAnswer === idx && !showCorrect
                        ? "lightblue"
                        : undefined,
                  cursor: selectedAnswer !== null ? "not-allowed" : "pointer",
                }}
              >
                {opt}
              </button>
            ))}
          </div>

          {showCorrect &&
            currentQuestion.question.correct_index !== undefined && (
              <p style={{ marginTop: 16 }}>
                Correct answer:{" "}
                <strong>
                  {
                    currentQuestion.question.options[
                      currentQuestion.question.correct_index
                    ]
                  }
                </strong>
              </p>
            )}

          {leaderboard.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h3>Leaderboard</h3>
              <ul>
                {leaderboard.map((p) => (
                  <li key={p.name}>
                    {p.rank}. {p.name} - {p.score} pts{" "}
                    {p.name === joined?.displayName ? "(You)" : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Join form
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          padding: 24,
          borderRadius: 12,
          border: "1px solid #ddd",
          boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
        }}
      >
        <h1>Join quiz</h1>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <label>
            Room code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. ABC123"
              style={{
                width: "100%",
                padding: 10,
                marginTop: 4,
                textTransform: "uppercase",
                letterSpacing: 2,
              }}
              required
            />
          </label>
          <label>
            First name
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              style={{ width: "100%", padding: 10, marginTop: 4 }}
              required
            />
          </label>
          <label>
            Last name
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              style={{ width: "100%", padding: 10, marginTop: 4 }}
              required
            />
          </label>
          {needsSuffix && (
            <label>
              Middle / suffix
              <input
                value={suffix}
                onChange={(e) => setSuffix(e.target.value)}
                required
              />
            </label>
          )}
          {error && <div style={{ color: "crimson" }}>{error}</div>}
          <button type="submit" disabled={busy}>
            {busy ? "Joining…" : "Join session"}
          </button>
        </form>
      </div>
    </div>
  );
}
