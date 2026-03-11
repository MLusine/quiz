import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

type AdminMe = { admin: { id: number; email: string } };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
    credentials: "include",
  });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as T;
}

function useAdminAuth() {
  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState<AdminMe["admin"] | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const me = await api<AdminMe>("/api/admin/me");
      setAdmin(me.admin);
    } catch {
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return { loading, admin, refresh };
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { loading, admin } = useAdminAuth();
  const location = useLocation();
  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (!admin) return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}

function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation() as unknown as { state?: { from?: string } };
  const from = useMemo(() => location.state?.from || "/admin", [location.state]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      navigate(from, { replace: true });
    } catch {
      setError("Invalid email or password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <form onSubmit={onSubmit} style={{ width: 360, display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Admin login</h2>
        <label>
          Email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>
        <label>
          Password
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>
        {error ? <div style={{ color: "crimson" }}>{error}</div> : null}
        <button disabled={busy} type="submit" style={{ padding: 10 }}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

type SessionSummary = {
  id: number;
  code: string;
  status: "WAITING" | "ACTIVE" | "FINISHED";
  maxParticipants: number;
  participantCount: number;
  createdAt: string;
};

type SessionsListResponse = { sessions: SessionSummary[] };

function useAdminSessions() {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<SessionsListResponse>("/api/admin/sessions");
      setSessions(data.sessions);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return { loading, sessions, error, refresh };
}

function AdminSessionsList() {
  const { loading, sessions, error, refresh } = useAdminSessions();
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await api("/api/admin/sessions", {
        method: "POST",
        body: JSON.stringify({ maxParticipants }),
      });
      await refresh();
    } catch {
      setCreateError("Failed to create session.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0 }}>Sessions</h2>
          <p style={{ margin: 0, color: "#555" }}>Create and control live quiz sessions.</p>
        </div>
        <button onClick={refresh} disabled={loading} style={{ padding: "6px 12px" }}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <section
        style={{
          marginBottom: 24,
          padding: 16,
          borderRadius: 8,
          border: "1px solid #ddd",
          maxWidth: 420,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Create new session</h3>
        <form onSubmit={onCreate} style={{ display: "grid", gap: 8 }}>
          <label>
            Max participants
            <input
              type="number"
              min={2}
              max={500}
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(Number(e.target.value))}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          {createError ? <div style={{ color: "crimson" }}>{createError}</div> : null}
          <button type="submit" disabled={creating} style={{ padding: 8 }}>
            {creating ? "Creating…" : "Create session"}
          </button>
        </form>
      </section>

      <section>
        <h3 style={{ marginTop: 0 }}>All sessions</h3>
        {error ? <div style={{ color: "crimson" }}>{error}</div> : null}
        {loading && sessions.length === 0 ? <div>Loading sessions…</div> : null}
        {sessions.length === 0 && !loading ? <div>No sessions yet. Create one above.</div> : null}
        {sessions.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse", maxWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>Code</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>Status</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>Participants</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>Created</th>
                <th style={{ padding: 8, borderBottom: "1px solid #ddd" }} />
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td style={{ padding: 8 }}>{s.code}</td>
                  <td style={{ padding: 8 }}>{s.status}</td>
                  <td style={{ padding: 8 }}>
                    {s.participantCount} / {s.maxParticipants}
                  </td>
                  <td style={{ padding: 8 }}>{new Date(s.createdAt).toLocaleString()}</td>
                  <td style={{ padding: 8, textAlign: "right" }}>
                    <Link to={`/admin/sessions/${s.id}`}>Open control panel</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </div>
  );
}

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
  };
};

function AdminSessionControl() {
  const params = useParams();
  const id = params.id;
  const [data, setData] = useState<SessionDetailResponse["session"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<SessionDetailResponse>(`/api/admin/sessions/${id}`);
      setData(res.session);
    } catch {
      setError("Failed to load session.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  if (!id) return <Navigate to="/admin" replace />;

  if (loading && !data) return <div style={{ padding: 24 }}>Loading session…</div>;
  if (error) return <div style={{ padding: 24, color: "crimson" }}>{error}</div>;
  if (!data) return <div style={{ padding: 24 }}>Session not found.</div>;

  return (
    <div style={{ padding: 24 }}>
      <Link to="/admin" style={{ display: "inline-block", marginBottom: 16 }}>
        ← Back to sessions
      </Link>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0 }}>Session {data.code}</h2>
          <p style={{ margin: 0, color: "#555" }}>{data.templateName}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div>Status: {data.status}</div>
          <div>
            Participants: {data.participantCount} / {data.maxParticipants}
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
            This is where you will start the session, advance activities, and control the timer.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={{ padding: 8 }} disabled>
              Start session (coming soon)
            </button>
            <button style={{ padding: 8 }} disabled>
              Next activity
            </button>
            <button style={{ padding: 8 }} disabled>
              End session
            </button>
          </div>
        </div>
        <div style={{ minWidth: 220 }}>
          <h3 style={{ marginTop: 0 }}>Current step</h3>
          <p style={{ marginTop: 0 }}>
            Activity index: {data.currentActivityIndex ?? 0} / question index: {data.currentQuestionIndex ?? 0}
          </p>
          <p style={{ marginTop: 0, color: "#777" }}>
            Timer, answer breakdowns, and leaderboard controls will appear here as you implement real-time logic.
          </p>
        </div>
      </section>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<div style={{ padding: 24 }}>Participant app (todo)</div>} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/admin/*"
        element={
          <RequireAdmin>
            <Routes>
              <Route path="" element={<AdminSessionsList />} />
              <Route path="sessions/:id" element={<AdminSessionControl />} />
            </Routes>
          </RequireAdmin>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
