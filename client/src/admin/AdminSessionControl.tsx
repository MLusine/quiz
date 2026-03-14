import { useState, useEffect, useRef } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import QRCode from "react-qr-code";
import { api } from "../api/api";

type SessionDetailResponse = {
  session: {
    id: number;
    code: string;
    status: "WAITING" | "ACTIVE" | "FINISHED";
    maxParticipants: number;
    participantCount: number;
    createdAt: string;
    startedAt?: string | null;
    currentActivityIndex?: number | null;
    currentQuestionIndex?: number | null;
    templateName: string;
    participants: { id: number; displayName: string; createdAt: string }[];
  };
};

export default function AdminSessionControl() {
  const socketRef = useRef<Socket | null>(null);
  const params = useParams();
  const id = params.id;
  const [data, setData] = useState<SessionDetailResponse["session"] | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<
    SessionDetailResponse["session"]["participants"]
  >([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<SessionDetailResponse>(`/api/admin/sessions/${id}`);
      setData(res.session);
      setParticipants(res.session.participants);
    } catch {
      setError("Failed to load session.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);


useEffect(() => {
  if (!data?.code) return;

  // prevent multiple sockets
  if (socketRef.current) return;

  const socket = io("http://localhost:4000", {
    transports: ["websocket", "polling"],
    withCredentials: true,
  });

  socketRef.current = socket;

  socket.on("connect", () => {
    console.log("Socket connected:", socket.id);

    socket.emit("admin:joinLobby", {
      sessionCode: data.code,
    });
  });

  socket.on("connect_error", (err) => {
    console.error("Socket connection error:", err);
  });

  socket.on("lobby:participantsUpdated", (payload) => {
    if (payload.sessionId === data.id) {
      setParticipants(payload.participants);
    }
  });

  return () => {
    socket.disconnect();
    socketRef.current = null;
  };
}, [data?.code]);




  const canStart =
    data && data.status === "WAITING" && participants.length >= 2;


    function handleNextActivity() {
  if (!data) return;

  socketRef.current?.emit("admin:nextActivity", {
    sessionCode: data.code,
  });
}

function handleNextQuestion() {
  if (!data) return;

  socketRef.current?.emit("admin:nextQuestion", {
    sessionCode: data.code,
  });
}
  const handleStart = async () => {
    if (!id || !canStart) return;
    setStarting(true);
    setActionError(null);
    try {
      const res = await api<SessionDetailResponse>(
        `/api/admin/sessions/${id}/start`,
        {
          method: "POST",
        },
      );
      setData(res.session);
    } catch (e) {
      const msg = String(e);
      if (msg.includes("400")) {
        setActionError(
          "Cannot start session yet. Check participant count and status.",
        );
      } else {
        setActionError("Failed to start session.");
      }
    } finally {
      setStarting(false);
    }
  };

  const handleRemove = async (participantId: number) => {
    if (!id || !data || data.status !== "WAITING") return;
    setRemovingId(participantId);
    setActionError(null);
    try {
      await api(`/api/admin/sessions/${id}/participants/${participantId}`, {
        method: "DELETE",
      });
      // participants will be updated via socket event
    } catch {
      setActionError("Failed to remove participant.");
    } finally {
      setRemovingId(null);
    }
  };

  if (!id) return <Navigate to="/admin" replace />;

  if (loading && !data)
    return <div style={{ padding: 24 }}>Loading session…</div>;
  if (error)
    return <div style={{ padding: 24, color: "crimson" }}>{error}</div>;
  if (!data) return <div style={{ padding: 24 }}>Session not found.</div>;

  return (
    <div style={{ padding: 24 }}>
      <Link to="/admin" style={{ display: "inline-block", marginBottom: 16 }}>
        ← Back to sessions
      </Link>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Session {data.code}</h2>
          <p style={{ margin: 0, color: "#555" }}>{data.templateName}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div>Status: {data.status}</div>
          <div>
            Participants: {participants.length} / {data.maxParticipants}
          </div>
        </div>
      </header>

      <section
        style={{
          marginBottom: 24,
          padding: 16,
          borderRadius: 8,
          border: "1px solid #ddd",
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3 style={{ marginTop: 0 }}>Host controls</h3>
          <p style={{ marginTop: 0, color: "#555" }}>
            This is where you will start the session, advance activities, and
            control the timer.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              style={{ padding: 8 }}
              disabled={!canStart || starting}
              onClick={handleStart}
            >
              {starting ? "Starting…" : "Start session"}
            </button>
            <button style={{ padding: 8 }} onClick={handleNextActivity}>
              Next activity
            </button>
            <button style={{ padding: 8 }} onClick={handleNextQuestion}>
  Next question
</button>
            <button style={{ padding: 8 }} disabled>
              End session
            </button>
          </div>
          {actionError ? (
            <p style={{ marginTop: 8, color: "crimson" }}>{actionError}</p>
          ) : null}
        </div>
        <div style={{ minWidth: 220 }}>
          <h3 style={{ marginTop: 0 }}>Current step</h3>
          <p style={{ marginTop: 0 }}>
            Activity index: {data.currentActivityIndex ?? 0} / question index:{" "}
            {data.currentQuestionIndex ?? 0}
          </p>
          <p style={{ marginTop: 0, color: "#777" }}>
            Timer, answer breakdowns, and leaderboard controls will appear here
            as you implement real-time logic.
          </p>
        </div>
      </section>
      <section
        style={{
          padding: 16,
          borderRadius: 8,
          border: "1px solid #ddd",
          maxWidth: 480,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Lobby</h3>
        <p
          style={{ marginTop: 0, marginBottom: 8, fontSize: 14, color: "#555" }}
        >
          Room code: <strong>{data.code}</strong>
        </p>
        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            alignItems: "flex-start",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              background: "white",
              padding: 8,
              borderRadius: 8,
              border: "1px solid #e5e7eb",
            }}
          >
            <QRCode
              value={
                typeof window !== "undefined"
                  ? `${window.location.origin}/?code=${encodeURIComponent(data.code)}`
                  : data.code
              }
              size={120}
            />
          </div>
          <div
            style={{ flex: 1, minWidth: 180, fontSize: 13, color: "#6b7280" }}
          >
            Ask participants to scan the QR code or enter the room code on their
            device to join this session.
          </div>
        </div>
        {participants.length === 0 ? (
          <p style={{ marginTop: 0, color: "#777" }}>
            No participants yet. Share the code or QR so people can join.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {participants.map((p) => (
              <li
                key={p.id}
                style={{
                  padding: "4px 0",
                  borderBottom: "1px solid #f3f4f6",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <span>{p.displayName}</span>
                {data.status === "WAITING" ? (
                  <button
                    type="button"
                    onClick={() => handleRemove(p.id)}
                    disabled={removingId === p.id}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#dc2626",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    {removingId === p.id ? "Removing…" : "Remove"}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
