import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { getSocketServer } from "../socket";
import { loadSessionTemplate } from "../sessionTemplate";


export const participantRouter = Router();

const JoinSchema = z.object({
  code: z.string().trim().min(4),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  displayName: z.string().trim().min(1).optional(),
});

participantRouter.post("/join", async (req, res) => {
  const parsed = JoinSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_BODY" });

  const codeInput = parsed.data.code.toUpperCase();
  const { firstName, lastName } = parsed.data;
  const displayName =
    parsed.data.displayName?.trim() || `${firstName.trim()} ${lastName.trim()}`;

  const session = await prisma.session.findUnique({
    where: { code: codeInput },
    include: { participants: true },
  });

  if (!session || session.status === "FINISHED") {
    return res.status(404).json({ error: "SESSION_NOT_FOUND" });
  }

  if (session.participants.length >= session.maxParticipants) {
    return res.status(409).json({ error: "ROOM_FULL" });
  }

  const exists = session.participants.some(
    (p) => p.displayName.toLowerCase() === displayName.toLowerCase()
  );
  if (exists) {
    return res.status(409).json({ error: "DUPLICATE_NAME" });
  }

  const created = await prisma.participant.create({
    data: {
      sessionId: session.id,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      displayName,
    },
  });

  const payload = {
    participantId: created.id,
    sessionId: session.id,
    sessionCode: session.code,
    displayName: created.displayName,
  };

  // Notify admin lobby listeners in real time
  try {
    const io = getSocketServer();
    io.to(`lobby:${session.code}`).emit("lobby:participantsUpdated", {
      sessionId: session.id,
      participants: session.participants
        .concat(created)
        .map((p) => ({ id: p.id, displayName: p.displayName, createdAt: p.createdAt })),
    });
  } catch {
    // socket server not ready - fail silently; HTTP response still succeeds
  }

  return res.status(201).json(payload);
});


// GET /api/participant/session/:id/quiz
participantRouter.get("/session/:id/quiz", async (req, res) => {
  const sessionId = Number(req.params.id);
  if (!Number.isFinite(sessionId)) return res.status(400).json({ error: "INVALID_ID" });

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) return res.status(404).json({ error: "SESSION_NOT_FOUND" });

  const template = loadSessionTemplate();

  // Get only quiz activities
  const quizActivities = template.session_template.activities.filter(a => a.type === "quiz");

  // Flatten all questions from all quiz activities
  const questions = quizActivities.flatMap(a =>
    a.questions.map(q => ({
      id: q.id,
      text: q.text,
      options: q.options,
      correct_index: q.correct_index,
      timer_seconds: a.timer_seconds, // use activity timer
    }))
  );

  res.json({ questions });
});