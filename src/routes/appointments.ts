import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { appointmentSchema, updateStatusSchema } from "../schemas/index.js";
import { ZodError } from "zod";

const router = Router();

// POST /appointments — apenas CANDIDATEs criam agendamentos
router.post("/", async (req, res) => {
  if (req.user!.role !== "CANDIDATE") {
    res.status(403).json({ error: "apenas candidatos podem agendar" });
    return;
  }

  try {
    const data = appointmentSchema.parse(req.body);

    const professional = await prisma.professional.findUnique({
      where: { id: data.professionalId },
    });
    if (!professional) {
      res.status(404).json({ error: "profissional não encontrado" });
      return;
    }

    const appointment = await prisma.appointment.create({
      data: {
        candidateId: req.user!.sub,
        professionalId: data.professionalId,
        serviceType: data.serviceType,
        scheduledAt: new Date(data.scheduledAt),
        notes: data.notes,
      },
      include: {
        professional: { include: { user: { select: { id: true, name: true } } } },
        candidate: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(201).json(appointment);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(422).json({ error: "Dados inválidos", details: err.errors });
      return;
    }
    throw err;
  }
});

// GET /appointments — candidato vê os seus; profissional vê os seus; ADMIN vê todos
router.get("/", async (req, res) => {
  const { role, sub } = req.user!;

  const where =
    role === "ADMIN"
      ? {}
      : role === "CANDIDATE"
      ? { candidateId: sub }
      : { professional: { userId: sub } };

  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      candidate: { select: { id: true, name: true, email: true } },
      professional: { include: { user: { select: { id: true, name: true } } } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  res.json(appointments);
});

// GET /appointments/:id
router.get("/:id", async (req, res) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      candidate: { select: { id: true, name: true, email: true } },
      professional: { include: { user: { select: { id: true, name: true } } } },
      review: true,
    },
  });

  if (!appointment) {
    res.status(404).json({ error: "agendamento não encontrado" });
    return;
  }

  const { role, sub } = req.user!;
  const isCandidate = appointment.candidateId === sub;
  const isProfessional = appointment.professional.userId === sub;
  if (role !== "ADMIN" && !isCandidate && !isProfessional) {
    res.status(403).json({ error: "permissão insuficiente" });
    return;
  }

  res.json(appointment);
});

// PATCH /appointments/:id/status — candidato cancela; profissional confirma/conclui; ADMIN tudo
router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = updateStatusSchema.parse(req.body);

    const appointment = await prisma.appointment.findUnique({
      where: { id: Number(req.params.id) },
      include: { professional: true },
    });
    if (!appointment) {
      res.status(404).json({ error: "agendamento não encontrado" });
      return;
    }

    const { role, sub } = req.user!;
    const isCandidate = appointment.candidateId === sub;
    const isProfessional = appointment.professional.userId === sub;

    if (role !== "ADMIN" && !isCandidate && !isProfessional) {
      res.status(403).json({ error: "permissão insuficiente" });
      return;
    }

    if (isCandidate && status !== "CANCELLED") {
      res.status(403).json({ error: "candidato só pode cancelar" });
      return;
    }

    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status },
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

// DELETE /appointments/:id — próprio candidato ou ADMIN
router.delete("/:id", async (req, res) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: Number(req.params.id) },
  });
  if (!appointment) {
    res.status(404).json({ error: "agendamento não encontrado" });
    return;
  }

  const isOwner = appointment.candidateId === req.user!.sub;
  if (!isOwner && req.user!.role !== "ADMIN") {
    res.status(403).json({ error: "permissão insuficiente" });
    return;
  }

  await prisma.appointment.delete({ where: { id: appointment.id } });
  res.status(204).send();
});

export default router;
