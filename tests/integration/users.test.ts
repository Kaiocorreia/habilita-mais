import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { hashPassword, signToken } from "../../src/lib/auth.js";

const app = createApp();

async function criarAdmin() {
  const admin = await prisma.user.create({
    data: { email: "admin-u@test.com", password: await hashPassword("senha123"), role: "ADMIN" },
  });
  return signToken({ sub: admin.id, email: admin.email, role: admin.role });
}

async function criarCandidato(email = "cand-u@test.com") {
  const user = await prisma.user.create({
    data: { email, password: await hashPassword("senha123"), role: "CANDIDATE" },
  });
  return { user, token: signToken({ sub: user.id, email: user.email, role: user.role }) };
}

describe("GET /users", () => {
  it("ADMIN lista todos os usuários", async () => {
    const adminToken = await criarAdmin();
    await criarCandidato();

    const res = await request(app).get("/users").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].password).toBeUndefined();
  });

  it("CANDIDATE não pode listar usuários (403)", async () => {
    const { token } = await criarCandidato();
    const res = await request(app).get("/users").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe("GET /users/:id", () => {
  it("usuário obtém seu próprio perfil", async () => {
    const { user, token } = await criarCandidato();
    const res = await request(app).get(`/users/${user.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(user.email);
    expect(res.body.password).toBeUndefined();
  });

  it("ADMIN obtém perfil de qualquer usuário", async () => {
    const adminToken = await criarAdmin();
    const { user } = await criarCandidato();

    const res = await request(app).get(`/users/${user.id}`).set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(user.email);
  });

  it("candidato não pode ver perfil de outro usuário (403)", async () => {
    const { user: user1, token: token1 } = await criarCandidato();
    const { user: user2 } = await criarCandidato("outro-u@test.com");

    const res = await request(app).get(`/users/${user2.id}`).set("Authorization", `Bearer ${token1}`);
    expect(res.status).toBe(403);
  });
});

describe("PUT /users/:id", () => {
  it("usuário atualiza seu próprio nome", async () => {
    const { user, token } = await criarCandidato();
    const res = await request(app)
      .put(`/users/${user.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Novo Nome" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Novo Nome");
  });

  it("usuário não pode atualizar perfil de outro (403)", async () => {
    const { token: token1 } = await criarCandidato();
    const { user: user2 } = await criarCandidato("outro-put@test.com");

    const res = await request(app)
      .put(`/users/${user2.id}`)
      .set("Authorization", `Bearer ${token1}`)
      .send({ name: "Tentativa" });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /users/:id", () => {
  it("ADMIN pode deletar usuário", async () => {
    const adminToken = await criarAdmin();
    const { user } = await criarCandidato();

    const res = await request(app).delete(`/users/${user.id}`).set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(204);
  });

  it("CANDIDATE não pode deletar usuário (403)", async () => {
    const { user, token } = await criarCandidato();
    const res = await request(app).delete(`/users/${user.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe("PATCH /users/:id/promote", () => {
  it("ADMIN promove usuário para PROFESSIONAL", async () => {
    const adminToken = await criarAdmin();
    const { user } = await criarCandidato();

    const res = await request(app)
      .patch(`/users/${user.id}/promote`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "PROFESSIONAL" });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("PROFESSIONAL");
  });

  it("retorna 400 para role inválido", async () => {
    const adminToken = await criarAdmin();
    const { user } = await criarCandidato();

    const res = await request(app)
      .patch(`/users/${user.id}/promote`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "SUPER_ADMIN" });
    expect(res.status).toBe(400);
  });

  it("CANDIDATE não pode promover usuário (403)", async () => {
    const { user, token } = await criarCandidato();
    const res = await request(app)
      .patch(`/users/${user.id}/promote`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "ADMIN" });
    expect(res.status).toBe(403);
  });
});
