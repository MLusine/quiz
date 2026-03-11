import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAdmin } from "../auth/requireAdmin";
import { loadSessionTemplate } from "../sessionTemplate";

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
      participantCount: (s as unknown as { _count: { participants: number } })._count.participants,
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
  if (!Number.isFinite(id)) return res.status(400).json({ error: "INVALID_ID" });

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
    },
  });
});

