import { Request, Response, NextFunction } from "express";
import { verifyToken, TokenPayload } from "../lib/auth.js";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "token ausente" });
    return;
  }

  const token = authHeader.substring(7);
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "token inválido ou expirado" });
  }
}
