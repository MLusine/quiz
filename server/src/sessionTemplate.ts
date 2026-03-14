// combinedSessionService.ts
import fs from "fs";
import path from "path";
import { z } from "zod";
import { getSocketServer } from "./socket";

/** ----------------- Template Validation ----------------- **/

const QuizQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  options: z.array(z.string()).length(4),
  correct_index: z.number().int().min(0).max(3),
});

const QuizActivitySchema = z.object({
  id: z.string(),
  type: z.literal("quiz"),
  step: z.number().int().min(1),
  title: z.string(),
  timer_seconds: z.number().int().positive(),
  scoring: z.object({
    mode: z.literal("time_weighted"),
    base_points: z.number().int().positive(),
  }),
  show_leaderboard_after_each: z.boolean(),
  questions: z.array(QuizQuestionSchema).min(1),
});

const PuzzleActivitySchema = z.object({
  id: z.string(),
  type: z.literal("puzzle_assembly"),
  step: z.number().int().min(1),
  title: z.string(),
  instruction: z.string(),
  timer_seconds: z.number().int().positive(),
  fragments_count: z.number().int().positive(),
  scoring: z.object({
    mode: z.literal("self_report"),
    points_per_correct: z.number().int().positive(),
  }),
});

const SessionTemplateSchema = z.object({
  session_template: z.object({
    name: z.string(),
    activities: z.array(z.union([QuizActivitySchema, PuzzleActivitySchema])).min(1),
  }),
});

export type LoadedSessionTemplate = z.infer<typeof SessionTemplateSchema>;

let cachedTemplate: LoadedSessionTemplate | null = null;

/**
 * Load and validate session template from JSON
 */
export function loadSessionTemplate(): LoadedSessionTemplate {
  if (cachedTemplate) return cachedTemplate;

  const filePath = path.join(__dirname, "..", "session_template.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw);
  const validated = SessionTemplateSchema.parse(parsed);
  cachedTemplate = validated;
  return validated;
}

/** ----------------- Live Session Management ----------------- **/

export interface Participant {
  id: number;
  name: string;
  score: number;
}

export interface LiveSession {
  sessionId: number;
  code: string;
  participants: Participant[];
  currentActivityIndex: number;
  currentQuestionIndex: number;
  questionEndTime?: number; // timestamp
  template?: LoadedSessionTemplate;
}

// In-memory store
export const liveSessions: Record<string, LiveSession> = {};

/**
 * Create a new live session
 */
export function createSession(code: string): LiveSession {
  const template = loadSessionTemplate();

  const newSession: LiveSession = {
    sessionId: Date.now(),
    code,
    participants: [],
    currentActivityIndex: 0,
    currentQuestionIndex: 0,
    template,
  };

  liveSessions[code] = newSession;
  return newSession;
}

/**
 * Participant joins a session
 */
export function joinSession(code: string, participant: { id: number; name: string }): LiveSession {
  const session = liveSessions[code];
  if (!session) throw new Error("Session not found");

  session.participants.push({ ...participant, score: 0 });

  // Notify lobby
  const io = getSocketServer();
  io.to(`lobby:${code}`).emit("session:updated", session);

  return session;
}

/**
 * Move to next question
 */
export function nextQuestion(code: string): LiveSession {
  const session = liveSessions[code];
  if (!session) throw new Error("Session not found");

  const activityIdx = session.currentActivityIndex;
  const qIdx = session.currentQuestionIndex;

  const activity = session.template?.session_template.activities[activityIdx];
  if (!activity || activity.type !== "quiz") {
    throw new Error("No quiz activity found at current index");
  }

  const question = activity.questions[qIdx];
  if (!question) {
    throw new Error("No question found at current index");
  }

  // Set question end time using the activity's timer
  const questionTimer = activity.timer_seconds;
  session.questionEndTime = Date.now() + questionTimer * 1000;

  // Increment question index for next call
  session.currentQuestionIndex += 1;

  // Emit event to all participants in the lobby
  const io = getSocketServer();
  io.to(`lobby:${session.code}`).emit("question:start", {
    activityIndex: activityIdx,
    questionIndex: qIdx,
    question,
    timer_seconds: questionTimer,
    endsAt: session.questionEndTime,
  });

  return session;
}
/**
 * Move to next activity
 */
export function nextActivity(code: string): LiveSession {
  const session = liveSessions[code];
  if (!session) throw new Error("Session not found");

  session.currentActivityIndex += 1;
  session.currentQuestionIndex = 0;

  const io = getSocketServer();
  io.to(`lobby:${code}`).emit("session:activityAdvanced", session);

  return session;
}