import { useState, useMemo,  } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "../api/api";

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation() as unknown as { state?: { from?: string } };
  const from = useMemo(
    () => location.state?.from || "/admin",
    [location.state],
  );

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
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{ width: 360, display: "grid", gap: 12 }}
      >
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