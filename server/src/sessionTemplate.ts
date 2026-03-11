import fs from "fs";
import path from "path";
import { z } from "zod";

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

export function loadSessionTemplate(): LoadedSessionTemplate {
  if (cachedTemplate) return cachedTemplate;
  const filePath = path.join(__dirname, "..", "session_template.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw);
  const validated = SessionTemplateSchema.parse(parsed);
  cachedTemplate = validated;
  return validated;
}

