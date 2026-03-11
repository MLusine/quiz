import jwt from "jsonwebtoken";
import { z } from "zod";

const JwtPayloadSchema = z.object({
  adminId: z.number().int().positive(),
});

export type AdminJwtPayload = z.infer<typeof JwtPayloadSchema>;

export function signAdminJwt(payload: AdminJwtPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

export function verifyAdminJwt(token: string): AdminJwtPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  const decoded = jwt.verify(token, secret);
  return JwtPayloadSchema.parse(decoded);
}

