import { Request, Response, NextFunction } from "express";

type Role = "CANDIDATE" | "PROFESSIONAL" | "ADMIN";

export function authorize(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "não autenticado" });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: "permissão insuficiente" });
      return;
    }
    next();
  };
}
