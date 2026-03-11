import http from "http";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { Server as SocketIOServer } from "socket.io";
import dotenv from "dotenv";
import { adminAuthRouter } from "./routes/adminAuth";
import { adminSessionsRouter } from "./routes/adminSessions";
import { loadSessionTemplate } from "./sessionTemplate";

dotenv.config();

// Validate content file on startup
loadSessionTemplate();

const app = express();
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true,
  },
});

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.use("/api/admin", adminAuthRouter);
app.use("/api/admin/sessions", adminSessionsRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

io.on("connection", (socket) => {
  // Placeholder; real handlers wired in separate module later
  console.log("Socket connected", socket.id);
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

