import type { Request, Response, NextFunction } from "express";
import { verifyAdminJwt } from "./jwt";

declare global {
  // eslint-disable-next-line no-var
  var __adminAuth: undefined;
}

declare module "express-serve-static-core" {
  interface Request {
    adminId?: number;
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: "UNAUTHENTICATED" });

  try {
    const payload = verifyAdminJwt(token);
    req.adminId = payload.adminId;
    return next();
  } catch {
    return res.status(401).json({ error: "UNAUTHENTICATED" });
  }
}

