import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { hashPassword, signToken } from "../../src/lib/auth.js";

const app = createApp();

async function registerAndLogin(email: string, role: "CANDIDATE" | "PROFESSIONAL" = "CANDIDATE") {
  await request(app).post("/auth/register").send({ email, password: "senha123", role });
  const res = await request(app).post("/auth/login").send({ email, password: "senha123" });
  return res.body.token as string;
}

async function createAdminToken(email: string): Promise<string> {
  const user = await prisma.user.create({
    data: { email, password: await hashPassword("senha123"), role: "ADMIN" },
  });
  return signToken({ sub: user.id, email: user.email, role: user.role });
}

describe("POST /professionals", () => {
  it("profissional cria seu perfil com sucesso", async () => {
    const token = await registerAndLogin("prof1@test.com", "PROFESSIONAL");
    const res = await request(app)
      .post("/professionals")
      .set("Authorization", `Bearer ${token}`)
      .send({ bio: "Instrutor experiente", location: "Vitória, ES", pricePerHour: 90, categories: "B" });
    expect(res.status).toBe(201);
    expect(res.body.location).toBe("Vitória, ES");
  });

  it("candidato não pode criar perfil de profissional (403)", async () => {
    const token = await registerAndLogin("cand1@test.com", "CANDIDATE");
    const res = await request(app)
      .post("/professionals")
      .set("Authorization", `Bearer ${token}`)
      .send({ bio: "tentativa inválida" });
    expect(res.status).toBe(403);
  });

  it("retorna 409 ao criar perfil duplicado", async () => {
    const token = await registerAndLogin("prof2@test.com", "PROFESSIONAL");
    await request(app).post("/professionals").set("Authorization", `Bearer ${token}`).send({ location: "ES" });
    const res = await request(app).post("/professionals").set("Authorization", `Bearer ${token}`).send({ location: "ES" });
    expect(res.status).toBe(409);
  });
});

describe("GET /professionals", () => {
  it("lista profissionais autenticado", async () => {
    const token = await registerAndLogin("viewer@test.com", "CANDIDATE");
    const res = await request(app).get("/professionals").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("retorna 401 sem token", async () => {
    const res = await request(app).get("/professionals");
    expect(res.status).toBe(401);
  });
});

describe("PUT /professionals/:id", () => {
  it("dono pode atualizar seu perfil", async () => {
    const token = await registerAndLogin("prof3@test.com", "PROFESSIONAL");
    const create = await request(app)
      .post("/professionals")
      .set("Authorization", `Bearer ${token}`)
      .send({ location: "ES" });
    const id = create.body.id;

    const res = await request(app)
      .put(`/professionals/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ location: "Rio de Janeiro, RJ", pricePerHour: 100 });
    expect(res.status).toBe(200);
    expect(res.body.location).toBe("Rio de Janeiro, RJ");
  });

  it("outro usuário não pode editar (403)", async () => {
    const token1 = await registerAndLogin("prof4@test.com", "PROFESSIONAL");
    const token2 = await registerAndLogin("outro@test.com", "CANDIDATE");

    const create = await request(app)
      .post("/professionals")
      .set("Authorization", `Bearer ${token1}`)
      .send({ location: "ES" });
    const id = create.body.id;

    const res = await request(app)
      .put(`/professionals/${id}`)
      .set("Authorization", `Bearer ${token2}`)
      .send({ location: "SP" });
    expect(res.status).toBe(403);
  });
});

describe("PATCH /professionals/:id/verify", () => {
  it("ADMIN verifica profissional com sucesso", async () => {
    const profToken = await registerAndLogin("prof5@test.com", "PROFESSIONAL");
    const adminToken = await createAdminToken("admin@test.com");

    const create = await request(app)
      .post("/professionals")
      .set("Authorization", `Bearer ${profToken}`)
      .send({});
    const id = create.body.id;

    const res = await request(app)
      .patch(`/professionals/${id}/verify`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.isVerified).toBe(true);
  });

  it("CANDIDATE não pode verificar profissional (403)", async () => {
    const profToken = await registerAndLogin("prof6@test.com", "PROFESSIONAL");
    const candToken = await registerAndLogin("cand6@test.com", "CANDIDATE");

    const create = await request(app)
      .post("/professionals")
      .set("Authorization", `Bearer ${profToken}`)
      .send({});
    const id = create.body.id;

    const res = await request(app)
      .patch(`/professionals/${id}/verify`)
      .set("Authorization", `Bearer ${candToken}`);
    expect(res.status).toBe(403);
  });
});
