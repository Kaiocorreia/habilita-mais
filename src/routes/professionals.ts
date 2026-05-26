import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authorize } from "../middlewares/authorize.js";
import { professionalSchema } from "../schemas/index.js";
import { ZodError } from "zod";

const router = Router();

// POST /professionals — usuário com role PROFESSIONAL cria seu perfil
router.post("/", authorize("PROFESSIONAL", "ADMIN"), async (req, res) => {
  try {
    const data = professionalSchema.parse(req.body);

    const existing = await prisma.professional.findUnique({ where: { userId: req.user!.sub } });
    if (existing) {
      res.status(409).json({ error: "perfil de profissional já existe" });
      return;
    }

    const professional = await prisma.professional.create({
      data: { ...data, userId: req.user!.sub },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    res.status(201).json(professional);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(422).json({ error: "Dados inválidos", details: err.errors });
      return;
    }
    throw err;
  }
});

// GET /professionals — listagem pública com filtros
router.get("/", async (req, res) => {
  const { location, womenOnly, isAccessible, category } = req.query;

  const professionals = await prisma.professional.findMany({
    where: {
      ...(location ? { location: { contains: String(location) } } : {}),
      ...(womenOnly === "true" ? { gender: "F" } : {}),
      ...(isAccessible === "true" ? { isAccessible: true } : {}),
      ...(category ? { categories: { contains: String(category) } } : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      reviews: { select: { rating: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const result = professionals.map((p) => ({
    ...p,
    averageRating:
      p.reviews.length > 0
        ? p.reviews.reduce((acc, r) => acc + r.rating, 0) / p.reviews.length
        : null,
    totalReviews: p.reviews.length,
  }));

  res.json(result);
});

// GET /professionals/:id — perfil completo com avaliações
router.get("/:id", async (req, res) => {
  const professional = await prisma.professional.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      user: { select: { id: true, name: true, email: true } },
      reviews: {
        include: { candidate: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!professional) {
    res.status(404).json({ error: "profissional não encontrado" });
    return;
  }

  const averageRating =
    professional.reviews.length > 0
      ? professional.reviews.reduce((acc, r) => acc + r.rating, 0) / professional.reviews.length
      : null;

  res.json({ ...professional, averageRating });
});

// PUT /professionals/:id — próprio profissional ou ADMIN
router.put("/:id", async (req, res) => {
  try {
    const professional = await prisma.professional.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!professional) {
      res.status(404).json({ error: "profissional não encontrado" });
      return;
    }

    const isOwner = professional.userId === req.user!.sub;
    const isAdmin = req.user!.role === "ADMIN";
    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: "permissão insuficiente" });
      return;
    }

    const data = professionalSchema.parse(req.body);
    const updated = await prisma.professional.update({
      where: { id: professional.id },
      data,
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    res.json(updated);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(422).json({ error: "Dados inválidos", details: err.errors });
      return;
    }
    throw err;
  }
});

// PATCH /professionals/:id/verify — somente ADMIN verifica profissional
router.patch("/:id/verify", authorize("ADMIN"), async (req, res) => {
  const professional = await prisma.professional.findUnique({
    where: { id: Number(req.params.id) },
  });
  if (!professional) {
    res.status(404).json({ error: "profissional não encontrado" });
    return;
  }

  const updated = await prisma.professional.update({
    where: { id: professional.id },
    data: { isVerified: true },
    select: { id: true, isVerified: true, userId: true },
  });
  res.json(updated);
});

// DELETE /professionals/:id — ADMIN only
router.delete("/:id", authorize("ADMIN"), async (req, res) => {
  await prisma.professional.delete({ where: { id: Number(req.params.id) } });
  res.status(204).send();
});

export default router;
