import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { reviewSchema } from "../schemas/index.js";
import { ZodError } from "zod";

const router = Router();

// POST /reviews — apenas candidatos avaliam após agendamento COMPLETED
router.post("/", async (req, res) => {
  if (req.user!.role !== "CANDIDATE") {
    res.status(403).json({ error: "apenas candidatos podem avaliar" });
    return;
  }

  try {
    const data = reviewSchema.parse(req.body);

    const appointment = await prisma.appointment.findUnique({
      where: { id: data.appointmentId },
      include: { review: true },
    });

    if (!appointment) {
      res.status(404).json({ error: "agendamento não encontrado" });
      return;
    }
    if (appointment.candidateId !== req.user!.sub) {
      res.status(403).json({ error: "permissão insuficiente" });
      return;
    }
    if (appointment.status !== "COMPLETED") {
      res.status(400).json({ error: "agendamento ainda não foi concluído" });
      return;
    }
    if (appointment.review) {
      res.status(409).json({ error: "agendamento já foi avaliado" });
      return;
    }

    const review = await prisma.review.create({
      data: {
        appointmentId: data.appointmentId,
        candidateId: req.user!.sub,
        professionalId: appointment.professionalId,
        rating: data.rating,
        comment: data.comment,
      },
      include: {
        candidate: { select: { id: true, name: true } },
        professional: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    res.status(201).json(review);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(422).json({ error: "Dados inválidos", details: err.errors });
      return;
    }
    throw err;
  }
});

// GET /reviews — listagem pública
router.get("/", async (_req, res) => {
  const reviews = await prisma.review.findMany({
    include: {
      candidate: { select: { id: true, name: true } },
      professional: { include: { user: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(reviews);
});

// GET /reviews/professional/:professionalId — avaliações de um profissional
router.get("/professional/:professionalId", async (req, res) => {
  const reviews = await prisma.review.findMany({
    where: { professionalId: Number(req.params.professionalId) },
    include: { candidate: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(reviews);
});

// GET /reviews/:id
router.get("/:id", async (req, res) => {
  const review = await prisma.review.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      candidate: { select: { id: true, name: true } },
      professional: { include: { user: { select: { id: true, name: true } } } },
    },
  });
  if (!review) {
    res.status(404).json({ error: "avaliação não encontrada" });
    return;
  }
  res.json(review);
});

// PUT /reviews/:id — apenas o autor pode editar
router.put("/:id", async (req, res) => {
  try {
    const review = await prisma.review.findUnique({ where: { id: Number(req.params.id) } });
    if (!review) {
      res.status(404).json({ error: "avaliação não encontrada" });
      return;
    }
    if (review.candidateId !== req.user!.sub) {
      res.status(403).json({ error: "permissão insuficiente" });
      return;
    }

    const { rating, comment } = req.body;
    const updated = await prisma.review.update({
      where: { id: review.id },
      data: { rating, comment },
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

// DELETE /reviews/:id — autor ou ADMIN
router.delete("/:id", async (req, res) => {
  const review = await prisma.review.findUnique({ where: { id: Number(req.params.id) } });
  if (!review) {
    res.status(404).json({ error: "avaliação não encontrada" });
    return;
  }

  const isOwner = review.candidateId === req.user!.sub;
  if (!isOwner && req.user!.role !== "ADMIN") {
    res.status(403).json({ error: "permissão insuficiente" });
    return;
  }

  await prisma.review.delete({ where: { id: review.id } });
  res.status(204).send();
});

export default router;
