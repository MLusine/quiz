import http from "http";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { Server as SocketIOServer } from "socket.io";
import dotenv from "dotenv";

import { adminAuthRouter } from "./routes/adminAuth";
import { adminSessionsRouter } from "./routes/adminSessions";
import { participantRouter } from "./routes/participant";
import { setSocketServer } from "./socket";
import {
  createSession,
  joinSession,
  nextQuestion,
  nextActivity,
  liveSessions,
  LiveSession,
} from "./sessionTemplate";

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true,
  },
});
setSocketServer(io);

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

// Routes
app.use("/api/admin", adminAuthRouter);
app.use("/api/admin/sessions", adminSessionsRouter);
app.use("/api/participant", participantRouter);

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok" }));

/** Helper: get current quiz question safely */
function getCurrentQuizQuestion(session: LiveSession) {
  if (
    session.currentActivityIndex == null ||
    session.currentQuestionIndex == null
  )
    return null;

  const activity =
    session.template?.session_template.activities[session.currentActivityIndex];
  if (!activity || activity.type !== "quiz") return null;

  const qIndex = session.currentQuestionIndex;
  if (qIndex < 0 || qIndex >= activity.questions.length) return null;

  return activity.questions[qIndex];
}

/** ------------------ Socket.IO ------------------ */
io.on("connection", (socket) => {
  console.log("New socket connected:", socket.id, socket.handshake.address);

  /** ------------------ Admin Events ------------------ **/

  socket.on(
    "admin:createSession",
    ({ sessionCode }: { sessionCode: string }) => {
      const code = sessionCode.toUpperCase();
      const session = createSession(code);
      socket.join(`lobby:${code}`);
      io.to(`lobby:${code}`).emit("session:created", session);
      console.log(`Session created: ${code}`);
    },
  );

  socket.on("admin:joinLobby", ({ sessionCode }: { sessionCode: string }) => {
    const code = sessionCode.toUpperCase();
    socket.join(`lobby:${code}`);
    console.log(`Admin joined lobby: ${code}`);
  });

  socket.on(
    "admin:nextQuestion",
    ({ sessionCode }: { sessionCode: string }) => {
      const code = sessionCode.toUpperCase();
      try {
        const session = nextQuestion(code);
        const activity =
          session.template?.session_template.activities[
            session.currentActivityIndex!
          ];
        if (!activity || activity.type !== "quiz") return;

        const questionIdx = session.currentQuestionIndex! - 1;
        const question = activity.questions[questionIdx];
        if (!question) return;

        session.questionEndTime = Date.now() + activity.timer_seconds * 1000;

        console.log(`Emitting question ${question.id} to lobby: ${code}`);
        io.to(`lobby:${code}`).emit("question:start", {
          activityIndex: session.currentActivityIndex,
          questionIndex: questionIdx,
          question,
          timer_seconds: activity.timer_seconds,
          endsAt: session.questionEndTime,
        });
      } catch (err) {
        socket.emit("error", { message: (err as Error).message });
      }
    },
  );

  socket.on(
    "admin:nextActivity",
    ({ sessionCode }: { sessionCode: string }) => {
      const code = sessionCode.toUpperCase();
      try {
        const session = nextActivity(code);
        const activity =
          session.template?.session_template.activities[
            session.currentActivityIndex!
          ];
        if (!activity) return;

        // Only auto-start if quiz
        if (activity.type === "quiz") {
          const question = activity.questions[0];
          if (!question) return;

          session.questionEndTime = Date.now() + activity.timer_seconds * 1000;
          console.log(
            `Starting first question ${question.id} of new activity ${activity.id}`,
          );
          io.to(`lobby:${code}`).emit("question:start", {
            activityIndex: session.currentActivityIndex,
            questionIndex: 0,
            question,
            timer_seconds: activity.timer_seconds,
            endsAt: session.questionEndTime,
          });
        }
      } catch (err) {
        socket.emit("error", { message: (err as Error).message });
      }
    },
  );

  /** ------------------ Participant Events ------------------ **/

  socket.on(
    "participant:joinLobby",
    ({
      sessionCode,
      participant,
    }: {
      sessionCode: string;
      participant: { id: number; name: string };
    }) => {
      const code = sessionCode.toUpperCase();
      socket.data.participantId = participant.id;

      try {
        joinSession(code, participant);
        socket.join(`lobby:${code}`);
        console.log(`${participant.name} joined lobby: ${code}`);

        // Send current question if quiz already started
        const session = liveSessions[code];
        const question = getCurrentQuizQuestion(session);

        if (question) {
          console.log(
            `Sending current question ${question.id} to ${participant.name}`,
          );
          socket.emit("question:start", {
            activityIndex: session.currentActivityIndex,
            questionIndex: session.currentQuestionIndex!,
            question,
            timer_seconds:
              session.template!.session_template.activities[
                session.currentActivityIndex!
              ].timer_seconds,
            endsAt: session.questionEndTime,
          });
        }
      } catch (err) {
        socket.emit("error", { message: (err as Error).message });
      }
    },
  );

  socket.on(
    "participant:answer",
    ({
      sessionId,
      questionId,
      answerIndex,
    }: {
      sessionId: number;
      questionId: string;
      answerIndex: number;
    }) => {
      const session = Object.values(liveSessions).find(
        (s) => s.sessionId === sessionId,
      );
      if (!session) return;

      const participant = session.participants.find(
        (p) => p.id === socket.data.participantId,
      );
      if (!participant) return;

      const activity =
        session.template?.session_template.activities[
          session.currentActivityIndex!
        ];
      if (!activity || activity.type !== "quiz") return;

      const question = activity.questions[session.currentQuestionIndex!];
      if (!question || question.id !== questionId) return;

      const isCorrect = question.correct_index === answerIndex;
      const remainingTime = Math.max(
        0,
        Math.floor((session.questionEndTime! - Date.now()) / 1000),
      );
      const points = isCorrect
        ? 50 + Math.round(50 * (remainingTime / activity.timer_seconds))
        : 0;

      participant.score += points;
      (participant as any).answers = (participant as any).answers || [];
      (participant as any).answers.push({
        questionId,
        answerIndex,
        isCorrect,
        points,
        timestamp: Date.now(),
      });

      io.to(`lobby:${session.code}`).emit("participant:scoreUpdated", {
        participantId: participant.id,
        newScore: participant.score,
      });

      console.log(
        `${participant.name} answered question ${questionId}, correct=${isCorrect}, points=${points}`,
      );
    },
  );

  socket.on("admin:endQuestion", ({ sessionCode }: { sessionCode: string }) => {
    const session = liveSessions[sessionCode.toUpperCase()];
    if (!session) return;

    const activity =
      session.template?.session_template.activities[
        session.currentActivityIndex!
      ];
    if (!activity || activity.type !== "quiz") return;

    const question = activity.questions[session.currentQuestionIndex!];
    if (!question) return;

    const leaderboard = session.participants
      .sort((a, b) => b.score - a.score)
      .map((p, idx) => ({ rank: idx + 1, name: p.name, score: p.score }));

    io.to(`lobby:${session.code}`).emit("question:ended", {
      correctIndex: question.correct_index,
      leaderboard,
    });
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
