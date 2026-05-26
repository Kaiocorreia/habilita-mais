import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authorize } from "../middlewares/authorize.js";

const router = Router();

// GET /users — ADMIN only
router.get("/", authorize("ADMIN"), async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(users);
});

// GET /users/:id — próprio usuário ou ADMIN
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (req.user!.sub !== id && req.user!.role !== "ADMIN") {
    res.status(403).json({ error: "permissão insuficiente" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  if (!user) {
    res.status(404).json({ error: "usuário não encontrado" });
    return;
  }
  res.json(user);
});

// PUT /users/:id — próprio usuário ou ADMIN
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (req.user!.sub !== id && req.user!.role !== "ADMIN") {
    res.status(403).json({ error: "permissão insuficiente" });
    return;
  }

  const { name } = req.body;
  const user = await prisma.user.update({
    where: { id },
    data: { name },
    select: { id: true, email: true, name: true, role: true },
  });
  res.json(user);
});

// DELETE /users/:id — ADMIN only
router.delete("/:id", authorize("ADMIN"), async (req, res) => {
  await prisma.user.delete({ where: { id: Number(req.params.id) } });
  res.status(204).send();
});

// PATCH /users/:id/promote — ADMIN only
router.patch("/:id/promote", authorize("ADMIN"), async (req, res) => {
  const { role } = req.body;
  if (!["CANDIDATE", "PROFESSIONAL", "ADMIN"].includes(role)) {
    res.status(400).json({ error: "role inválido" });
    return;
  }
  const user = await prisma.user.update({
    where: { id: Number(req.params.id) },
    data: { role },
    select: { id: true, email: true, name: true, role: true },
  });
  res.json(user);
});

export default router;
