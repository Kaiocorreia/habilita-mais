import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { hashPassword, signToken } from "../../src/lib/auth.js";

const app = createApp();

async function criarCenario() {
  const candidate = await prisma.user.create({
    data: { email: "candidato@cen.com", password: await hashPassword("senha123"), role: "CANDIDATE" },
  });
  const profUser = await prisma.user.create({
    data: { email: "prof@cen.com", password: await hashPassword("senha123"), role: "PROFESSIONAL" },
  });
  const professional = await prisma.professional.create({
    data: { userId: profUser.id, location: "Vitória", pricePerHour: 90, categories: "B" },
  });

  const candToken = signToken({ sub: candidate.id, email: candidate.email, role: candidate.role });
  const profToken = signToken({ sub: profUser.id, email: profUser.email, role: profUser.role });

  return { candidate, profUser, professional, candToken, profToken };
}

describe("POST /appointments", () => {
  it("candidato cria agendamento com sucesso", async () => {
    const { professional, candToken } = await criarCenario();
    const res = await request(app)
      .post("/appointments")
      .set("Authorization", `Bearer ${candToken}`)
      .send({
        professionalId: professional.id,
        serviceType: "Aula prática",
        scheduledAt: "2026-06-10T10:00:00.000Z",
        notes: "Primeira aula",
      });
    expect(res.status).toBe(201);
    expect(res.body.serviceType).toBe("Aula prática");
    expect(res.body.status).toBe("PENDING");
  });

  it("profissional não pode criar agendamento (403)", async () => {
    const { professional, profToken } = await criarCenario();
    const res = await request(app)
      .post("/appointments")
      .set("Authorization", `Bearer ${profToken}`)
      .send({ professionalId: professional.id, serviceType: "Teste", scheduledAt: "2026-06-01T09:00:00.000Z" });
    expect(res.status).toBe(403);
  });

  it("retorna 401 sem token", async () => {
    const res = await request(app).post("/appointments").send({ professionalId: 1 });
    expect(res.status).toBe(401);
  });
});

describe("GET /appointments", () => {
  it("candidato lista seus próprios agendamentos", async () => {
    const { professional, candToken } = await criarCenario();
    await request(app)
      .post("/appointments")
      .set("Authorization", `Bearer ${candToken}`)
      .send({ professionalId: professional.id, serviceType: "Aula", scheduledAt: "2026-06-15T09:00:00.000Z" });

    const res = await request(app).get("/appointments").set("Authorization", `Bearer ${candToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

describe("PATCH /appointments/:id/status", () => {
  it("profissional confirma agendamento", async () => {
    const { professional, candToken, profToken } = await criarCenario();
    const create = await request(app)
      .post("/appointments")
      .set("Authorization", `Bearer ${candToken}`)
      .send({ professionalId: professional.id, serviceType: "Aula", scheduledAt: "2026-06-20T09:00:00.000Z" });
    const id = create.body.id;

    const res = await request(app)
      .patch(`/appointments/${id}/status`)
      .set("Authorization", `Bearer ${profToken}`)
      .send({ status: "CONFIRMED" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("CONFIRMED");
  });

  it("candidato cancela agendamento", async () => {
    const { professional, candToken } = await criarCenario();
    const create = await request(app)
      .post("/appointments")
      .set("Authorization", `Bearer ${candToken}`)
      .send({ professionalId: professional.id, serviceType: "Aula", scheduledAt: "2026-06-25T09:00:00.000Z" });
    const id = create.body.id;

    const res = await request(app)
      .patch(`/appointments/${id}/status`)
      .set("Authorization", `Bearer ${candToken}`)
      .send({ status: "CANCELLED" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("CANCELLED");
  });

  it("candidato não pode CONFIRMAR agendamento (403)", async () => {
    const { professional, candToken } = await criarCenario();
    const create = await request(app)
      .post("/appointments")
      .set("Authorization", `Bearer ${candToken}`)
      .send({ professionalId: professional.id, serviceType: "Aula", scheduledAt: "2026-06-28T09:00:00.000Z" });
    const id = create.body.id;

    const res = await request(app)
      .patch(`/appointments/${id}/status`)
      .set("Authorization", `Bearer ${candToken}`)
      .send({ status: "CONFIRMED" });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /appointments/:id", () => {
  it("candidato (dono) pode deletar agendamento", async () => {
    const { professional, candToken } = await criarCenario();
    const create = await request(app)
      .post("/appointments")
      .set("Authorization", `Bearer ${candToken}`)
      .send({ professionalId: professional.id, serviceType: "Aula", scheduledAt: "2026-07-01T09:00:00.000Z" });
    const id = create.body.id;

    const res = await request(app).delete(`/appointments/${id}`).set("Authorization", `Bearer ${candToken}`);
    expect(res.status).toBe(204);
  });

  it("usuário diferente não pode deletar agendamento de outro (403)", async () => {
    const { professional, candToken } = await criarCenario();
    const outro = await prisma.user.create({
      data: { email: "outro2@test.com", password: await hashPassword("123456"), role: "CANDIDATE" },
    });
    const outroToken = signToken({ sub: outro.id, email: outro.email, role: outro.role });

    const create = await request(app)
      .post("/appointments")
      .set("Authorization", `Bearer ${candToken}`)
      .send({ professionalId: professional.id, serviceType: "Aula", scheduledAt: "2026-07-05T09:00:00.000Z" });
    const id = create.body.id;

    const res = await request(app).delete(`/appointments/${id}`).set("Authorization", `Bearer ${outroToken}`);
    expect(res.status).toBe(403);
  });
});
