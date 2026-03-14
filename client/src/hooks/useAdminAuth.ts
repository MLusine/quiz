import { useState, useEffect } from "react";

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


export default function useAdminAuth() {
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