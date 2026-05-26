import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { hashPassword, signToken } from "../../src/lib/auth.js";

const app = createApp();

async function criarCenario() {
  const candidate = await prisma.user.create({
    data: { email: "rev-cand@test.com", password: await hashPassword("senha123"), role: "CANDIDATE" },
  });
  const profUser = await prisma.user.create({
    data: { email: "rev-prof@test.com", password: await hashPassword("senha123"), role: "PROFESSIONAL" },
  });
  const professional = await prisma.professional.create({
    data: { userId: profUser.id, location: "Vitória", pricePerHour: 80, categories: "B" },
  });
  const appointment = await prisma.appointment.create({
    data: {
      candidateId: candidate.id,
      professionalId: professional.id,
      serviceType: "Aula prática",
      scheduledAt: new Date("2026-06-10T10:00:00Z"),
      status: "COMPLETED",
    },
  });

  const candToken = signToken({ sub: candidate.id, email: candidate.email, role: candidate.role });
  const profToken = signToken({ sub: profUser.id, email: profUser.email, role: profUser.role });
  const adminUser = await prisma.user.create({
    data: { email: "rev-admin@test.com", password: await hashPassword("senha123"), role: "ADMIN" },
  });
  const adminToken = signToken({ sub: adminUser.id, email: adminUser.email, role: adminUser.role });

  return { candidate, profUser, professional, appointment, candToken, profToken, adminToken };
}

describe("POST /reviews", () => {
  it("candidato avalia agendamento concluído com sucesso", async () => {
    const { appointment, candToken } = await criarCenario();
    const res = await request(app)
      .post("/reviews")
      .set("Authorization", `Bearer ${candToken}`)
      .send({ appointmentId: appointment.id, rating: 5, comment: "Ótimo instrutor!" });
    expect(res.status).toBe(201);
    expect(res.body.rating).toBe(5);
    expect(res.body.comment).toBe("Ótimo instrutor!");
  });

  it("profissional não pode avaliar (403)", async () => {
    const { appointment, profToken } = await criarCenario();
    const res = await request(app)
      .post("/reviews")
      .set("Authorization", `Bearer ${profToken}`)
      .send({ appointmentId: appointment.id, rating: 4 });
    expect(res.status).toBe(403);
  });

  it("retorna 404 para agendamento inexistente", async () => {
    const { candToken } = await criarCenario();
    const res = await request(app)
      .post("/reviews")
      .set("Authorization", `Bearer ${candToken}`)
      .send({ appointmentId: 99999, rating: 3 });
    expect(res.status).toBe(404);
  });

  it("retorna 400 se agendamento não foi concluído", async () => {
    const candidate = await prisma.user.create({
      data: { email: "pend-cand@test.com", password: await hashPassword("x"), role: "CANDIDATE" },
    });
    const profUser = await prisma.user.create({
      data: { email: "pend-prof@test.com", password: await hashPassword("x"), role: "PROFESSIONAL" },
    });
    const professional = await prisma.professional.create({
      data: { userId: profUser.id, categories: "B" },
    });
    const appointment = await prisma.appointment.create({
      data: {
        candidateId: candidate.id,
        professionalId: professional.id,
        serviceType: "Aula",
        scheduledAt: new Date("2026-07-01T10:00:00Z"),
        status: "PENDING",
      },
    });
    const candToken = signToken({ sub: candidate.id, email: candidate.email, role: candidate.role });

    const res = await request(app)
      .post("/reviews")
      .set("Authorization", `Bearer ${candToken}`)
      .send({ appointmentId: appointment.id, rating: 4 });
    expect(res.status).toBe(400);
  });

  it("retorna 409 se agendamento já foi avaliado", async () => {
    const { appointment, professional, candidate, candToken } = await (async () => {
      const s = await criarCenario();
      return { ...s, candidate: await prisma.user.findUnique({ where: { email: "rev-cand@test.com" } }) };
    })();
    await prisma.review.create({
      data: {
        appointmentId: appointment.id,
        candidateId: candidate!.id,
        professionalId: professional.id,
        rating: 5,
      },
    });

    const res = await request(app)
      .post("/reviews")
      .set("Authorization", `Bearer ${candToken}`)
      .send({ appointmentId: appointment.id, rating: 4 });
    expect(res.status).toBe(409);
  });
});

describe("GET /reviews", () => {
  it("lista todas as avaliações", async () => {
    const { appointment, professional, candToken } = await criarCenario();
    const candidate = await prisma.user.findUnique({ where: { email: "rev-cand@test.com" } });
    await prisma.review.create({
      data: { appointmentId: appointment.id, candidateId: candidate!.id, professionalId: professional.id, rating: 4 },
    });

    const res = await request(app).get("/reviews").set("Authorization", `Bearer ${candToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

describe("GET /reviews/professional/:id", () => {
  it("lista avaliações de um profissional", async () => {
    const { appointment, professional, candToken } = await criarCenario();
    const candidate = await prisma.user.findUnique({ where: { email: "rev-cand@test.com" } });
    await prisma.review.create({
      data: { appointmentId: appointment.id, candidateId: candidate!.id, professionalId: professional.id, rating: 3 },
    });

    const res = await request(app)
      .get(`/reviews/professional/${professional.id}`)
      .set("Authorization", `Bearer ${candToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].rating).toBe(3);
  });
});

describe("GET /reviews/:id", () => {
  it("retorna avaliação por id", async () => {
    const { appointment, professional, candToken } = await criarCenario();
    const candidate = await prisma.user.findUnique({ where: { email: "rev-cand@test.com" } });
    const review = await prisma.review.create({
      data: { appointmentId: appointment.id, candidateId: candidate!.id, professionalId: professional.id, rating: 5 },
    });

    const res = await request(app)
      .get(`/reviews/${review.id}`)
      .set("Authorization", `Bearer ${candToken}`);
    expect(res.status).toBe(200);
    expect(res.body.rating).toBe(5);
  });

  it("retorna 404 para id inexistente", async () => {
    const { candToken } = await criarCenario();
    const res = await request(app).get("/reviews/99999").set("Authorization", `Bearer ${candToken}`);
    expect(res.status).toBe(404);
  });
});

describe("PUT /reviews/:id", () => {
  it("autor edita sua avaliação", async () => {
    const { appointment, professional, candToken } = await criarCenario();
    const candidate = await prisma.user.findUnique({ where: { email: "rev-cand@test.com" } });
    const review = await prisma.review.create({
      data: { appointmentId: appointment.id, candidateId: candidate!.id, professionalId: professional.id, rating: 3 },
    });

    const res = await request(app)
      .put(`/reviews/${review.id}`)
      .set("Authorization", `Bearer ${candToken}`)
      .send({ rating: 5, comment: "Melhorou muito!" });
    expect(res.status).toBe(200);
    expect(res.body.rating).toBe(5);
  });

  it("não-autor não pode editar (403)", async () => {
    const { appointment, professional } = await criarCenario();
    const candidate = await prisma.user.findUnique({ where: { email: "rev-cand@test.com" } });
    const review = await prisma.review.create({
      data: { appointmentId: appointment.id, candidateId: candidate!.id, professionalId: professional.id, rating: 3 },
    });

    const outro = await prisma.user.create({
      data: { email: "outro-rev@test.com", password: await hashPassword("x"), role: "CANDIDATE" },
    });
    const outroToken = signToken({ sub: outro.id, email: outro.email, role: outro.role });

    const res = await request(app)
      .put(`/reviews/${review.id}`)
      .set("Authorization", `Bearer ${outroToken}`)
      .send({ rating: 1 });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /reviews/:id", () => {
  it("autor pode deletar sua avaliação", async () => {
    const { appointment, professional, candToken } = await criarCenario();
    const candidate = await prisma.user.findUnique({ where: { email: "rev-cand@test.com" } });
    const review = await prisma.review.create({
      data: { appointmentId: appointment.id, candidateId: candidate!.id, professionalId: professional.id, rating: 4 },
    });

    const res = await request(app)
      .delete(`/reviews/${review.id}`)
      .set("Authorization", `Bearer ${candToken}`);
    expect(res.status).toBe(204);
  });

  it("ADMIN pode deletar qualquer avaliação", async () => {
    const { appointment, professional, adminToken } = await criarCenario();
    const candidate = await prisma.user.findUnique({ where: { email: "rev-cand@test.com" } });
    const review = await prisma.review.create({
      data: { appointmentId: appointment.id, candidateId: candidate!.id, professionalId: professional.id, rating: 2 },
    });

    const res = await request(app)
      .delete(`/reviews/${review.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(204);
  });

  it("não-autor não pode deletar (403)", async () => {
    const { appointment, professional } = await criarCenario();
    const candidate = await prisma.user.findUnique({ where: { email: "rev-cand@test.com" } });
    const review = await prisma.review.create({
      data: { appointmentId: appointment.id, candidateId: candidate!.id, professionalId: professional.id, rating: 1 },
    });

    const outro = await prisma.user.create({
      data: { email: "outro-del@test.com", password: await hashPassword("x"), role: "CANDIDATE" },
    });
    const outroToken = signToken({ sub: outro.id, email: outro.email, role: outro.role });

    const res = await request(app)
      .delete(`/reviews/${review.id}`)
      .set("Authorization", `Bearer ${outroToken}`);
    expect(res.status).toBe(403);
  });
});
