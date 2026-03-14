import { useState } from "react";
import useAdminSessions from "../hooks/useAdminSessions";
import { Link } from "react-router-dom";
import { api } from "../api/api";

export default function AdminSessionsList() {
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
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Sessions</h2>
          <p style={{ margin: 0, color: "#555" }}>
            Create and control live quiz sessions.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          style={{ padding: "6px 12px" }}
        >
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
          {createError ? (
            <div style={{ color: "crimson" }}>{createError}</div>
          ) : null}
          <button type="submit" disabled={creating} style={{ padding: 8 }}>
            {creating ? "Creating…" : "Create session"}
          </button>
        </form>
      </section>

      <section>
        <h3 style={{ marginTop: 0 }}>All sessions</h3>
        {error ? <div style={{ color: "crimson" }}>{error}</div> : null}
        {loading && sessions.length === 0 ? <div>Loading sessions…</div> : null}
        {sessions.length === 0 && !loading ? (
          <div>No sessions yet. Create one above.</div>
        ) : null}
        {sessions.length > 0 ? (
          <table
            style={{ width: "100%", borderCollapse: "collapse", maxWidth: 900 }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    padding: 8,
                    borderBottom: "1px solid #ddd",
                  }}
                >
                  Code
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: 8,
                    borderBottom: "1px solid #ddd",
                  }}
                >
                  Status
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: 8,
                    borderBottom: "1px solid #ddd",
                  }}
                >
                  Participants
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: 8,
                    borderBottom: "1px solid #ddd",
                  }}
                >
                  Created
                </th>
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
                  <td style={{ padding: 8 }}>
                    {new Date(s.createdAt).toLocaleString()}
                  </td>
                  <td style={{ padding: 8, textAlign: "right" }}>
                    <Link to={`/admin/sessions/${s.id}`}>
                      Open control panel
                    </Link>
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