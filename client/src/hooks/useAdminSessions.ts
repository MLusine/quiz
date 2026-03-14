import { useState, useEffect } from "react";
import { api } from "../api/api";

type SessionSummary = {
  id: number;
  code: string;
  status: "WAITING" | "ACTIVE" | "FINISHED";
  maxParticipants: number;
  participantCount: number;
  createdAt: string;
};

type SessionsListResponse = { sessions: SessionSummary[] };

export default function useAdminSessions() {
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
