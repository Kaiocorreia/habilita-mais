import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword, signToken } from "../lib/auth.js";
import { authenticate } from "../middlewares/authenticate.js";
import { registerSchema, loginSchema } from "../schemas/index.js";
import { ZodError } from "zod";

const router = Router();

// POST /auth/register
router.post("/register", async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      res.status(409).json({ error: "email já cadastrado" });
      return;
    }

    const hash = await hashPassword(data.password);
    const user = await prisma.user.create({
      data: { email: data.email, name: data.name, password: hash, role: data.role ?? "CANDIDATE" },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    res.status(201).json(user);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(422).json({ error: "Dados inválidos", details: err.errors });
      return;
    }
    throw err;
  }
});

// POST /auth/login
router.post("/login", async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      res.status(401).json({ error: "credenciais inválidas" });
      return;
    }

    const valid = await verifyPassword(data.password, user.password);
    if (!valid) {
      res.status(401).json({ error: "credenciais inválidas" });
      return;
    }

    const token = signToken({ sub: user.id, email: user.email, role: user.role });
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(422).json({ error: "Dados inválidos", details: err.errors });
      return;
    }
    throw err;
  }
});

// GET /auth/me
router.get("/me", authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  if (!user) {
    res.status(404).json({ error: "usuário não encontrado" });
    return;
  }
  res.json(user);
});

export default router;
