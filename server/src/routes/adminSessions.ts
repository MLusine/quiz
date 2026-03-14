import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAdmin } from "../auth/requireAdmin";
import { loadSessionTemplate } from "../sessionTemplate";
import { getSocketServer } from "../socket";

export const adminSessionsRouter = Router();

const CreateSessionSchema = z.object({
  maxParticipants: z.number().int().min(2).max(500),
});

function generateRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

adminSessionsRouter.use(requireAdmin);

adminSessionsRouter.get("/", async (_req, res) => {
  const sessions = await prisma.session.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { participants: true } },
    },
  });

  return res.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      code: s.code,
      status: s.status,
      maxParticipants: s.maxParticipants,
      participantCount: (s as unknown as { _count: { participants: number } })
        ._count.participants,
      createdAt: s.createdAt,
    })),
  });
});

adminSessionsRouter.post("/", async (req, res) => {
  const parsed = CreateSessionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_BODY" });

  const { maxParticipants } = parsed.data;
  const template = loadSessionTemplate();

  let code = generateRoomCode();
  // naive collision retry
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const existing = await prisma.session.findUnique({ where: { code } });
    if (!existing) break;
    code = generateRoomCode();
  }

  const created = await prisma.session.create({
    data: {
      code,
      maxParticipants,
      templateKey: template.session_template.name,
    },
  });

  return res.status(201).json({
    session: {
      id: created.id,
      code: created.code,
      status: created.status,
      maxParticipants: created.maxParticipants,
      participantCount: 0,
      createdAt: created.createdAt,
    },
  });
});

adminSessionsRouter.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id))
    return res.status(400).json({ error: "INVALID_ID" });

  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      participants: true,
    },
  });
  if (!session) return res.status(404).json({ error: "NOT_FOUND" });

  const template = loadSessionTemplate();

  return res.json({
    session: {
      id: session.id,
      code: session.code,
      status: session.status,
      maxParticipants: session.maxParticipants,
      participantCount: session.participants.length,
      createdAt: session.createdAt,
      startedAt: session.startedAt,
      currentActivityIndex: session.currentActivityIndex,
      currentQuestionIndex: session.currentQuestionIndex,
      templateName: template.session_template.name,
      participants: session.participants.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        createdAt: p.createdAt,
      })),
    },
  });
});

adminSessionsRouter.post("/:id/start", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id))
    return res.status(400).json({ error: "INVALID_ID" });

  const session = await prisma.session.findUnique({
    where: { id },
    include: { participants: true },
  });
  if (!session) return res.status(404).json({ error: "NOT_FOUND" });

  if (session.status !== "WAITING") {
    return res.status(400).json({ error: "ALREADY_STARTED" });
  }

  if (session.participants.length < 2) {
    return res.status(400).json({ error: "NOT_ENOUGH_PARTICIPANTS" });
  }

  // Load template
  const template = loadSessionTemplate();
  const firstActivity = template.session_template.activities[0];

  // Determine first question info
  let firstQuestion = null;
  let timer_seconds = 0;
  let endsAt = null;

  if (firstActivity.type === "quiz" && firstActivity.questions.length > 0) {
    firstQuestion = firstActivity.questions[0];
    timer_seconds = firstActivity.timer_seconds || 30;
    endsAt = Date.now() + timer_seconds * 1000;
  }

  // Update session in DB
  const updated = await prisma.session.update({
    where: { id: session.id },
    data: {
      status: "ACTIVE",
      startedAt: new Date(),
      currentActivityIndex: 0,
      currentQuestionIndex: firstQuestion ? 0 : null,
    },
    include: { participants: true },
  });

  const io = getSocketServer();

  try {
    // Notify lobby that session started
    io.to(`lobby:${updated.code}`).emit("session:started", {
      sessionId: updated.id,
      code: updated.code,
      startedAt: updated.startedAt,
    });

    // Emit first question if quiz
    if (firstQuestion) {
      io.to(`lobby:${updated.code}`).emit("question:start", {
        activityIndex: 0,
        questionIndex: 0,
        question: firstQuestion,
        timer_seconds,
        endsAt,
      });
    }
  } catch (err) {
    console.error("Socket emit error:", err);
  }

  // Return updated session
  return res.json({
    session: {
      id: updated.id,
      code: updated.code,
      status: updated.status,
      maxParticipants: updated.maxParticipants,
      participantCount: updated.participants.length,
      createdAt: updated.createdAt,
      startedAt: updated.startedAt,
      currentActivityIndex: updated.currentActivityIndex,
      currentQuestionIndex: updated.currentQuestionIndex,
      templateName: template.session_template.name,
      participants: updated.participants.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        createdAt: p.createdAt,
      })),
    },
  });
});

adminSessionsRouter.delete(
  "/:id/participants/:participantId",
  async (req, res) => {
    const id = Number(req.params.id);
    const participantId = Number(req.params.participantId);
    if (!Number.isFinite(id) || !Number.isFinite(participantId)) {
      return res.status(400).json({ error: "INVALID_ID" });
    }

    const session = await prisma.session.findUnique({
      where: { id },
      include: { participants: true },
    });
    if (!session) return res.status(404).json({ error: "NOT_FOUND" });

    if (session.status !== "WAITING") {
      return res.status(400).json({ error: "CANNOT_REMOVE_AFTER_START" });
    }

    const toRemove = session.participants.find((p) => p.id === participantId);
    if (!toRemove)
      return res.status(404).json({ error: "PARTICIPANT_NOT_FOUND" });

    await prisma.participant.delete({ where: { id: participantId } });

    const remaining = await prisma.participant.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: "asc" },
    });

    try {
      const io = getSocketServer();
      io.to(`lobby:${session.code}`).emit("lobby:participantsUpdated", {
        sessionId: session.id,
        participants: remaining.map((p) => ({
          id: p.id,
          displayName: p.displayName,
          createdAt: p.createdAt,
        })),
      });
    } catch {
      // ignore socket errors
    }

    return res.json({
      sessionId: session.id,
      participants: remaining.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        createdAt: p.createdAt,
      })),
    });
  },
);
