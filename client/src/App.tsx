import { Routes, Route, Navigate } from "react-router-dom";

import AdminLogin from "./admin/AdminLogin";
import AdminSessionsList from "./admin/AdminSessionsList";
import AdminSessionControl from "./admin/AdminSessionControl";
import RequireAdmin from "./components/RequireAdmin";
import ParticipantApp from "./participant/ParticipantApp";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ParticipantApp />} />

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
