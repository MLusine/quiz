import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import { prisma } from "../db";
import { signAdminJwt, verifyAdminJwt } from "../auth/jwt";

export const adminAuthRouter = Router();

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

adminAuthRouter.post("/login", async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_BODY" });

  const { email, password } = parsed.data;
  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

  const token = signAdminJwt({ adminId: admin.id });

  const isProd = process.env.NODE_ENV === "production";
  res.cookie("admin_token", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.json({ ok: true });
});

adminAuthRouter.post("/logout", async (_req, res) => {
  res.clearCookie("admin_token", { path: "/" });
  return res.json({ ok: true });
});

adminAuthRouter.get("/me", async (req, res) => {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: "UNAUTHENTICATED" });
  try {
    const payload = verifyAdminJwt(token);
    const admin = await prisma.admin.findUnique({
      where: { id: payload.adminId },
      select: { id: true, email: true, createdAt: true },
    });
    if (!admin) return res.status(401).json({ error: "UNAUTHENTICATED" });
    return res.json({ admin });
  } catch {
    return res.status(401).json({ error: "UNAUTHENTICATED" });
  }
});

