import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";

const app = createApp();

describe("POST /auth/register", () => {
  it("cria usuário com dados válidos e retorna 201", async () => {
    const res = await request(app).post("/auth/register").send({
      email: "candidato@habilita.com",
      name: "Candidato Teste",
      password: "senha123",
    });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe("candidato@habilita.com");
    expect(res.body.password).toBeUndefined();
    expect(res.body.role).toBe("CANDIDATE");
  });

  it("retorna 409 para email duplicado", async () => {
    await request(app).post("/auth/register").send({ email: "dup@test.com", password: "123456" });
    const res = await request(app).post("/auth/register").send({ email: "dup@test.com", password: "outrasenha" });
    expect(res.status).toBe(409);
  });

  it("retorna 422 para dados inválidos (senha curta)", async () => {
    const res = await request(app).post("/auth/register").send({
      email: "valido@test.com",
      password: "123",
    });
    expect(res.status).toBe(422);
  });

  it("retorna 422 para email inválido", async () => {
    const res = await request(app).post("/auth/register").send({
      email: "nao-e-email",
      password: "senha123",
    });
    expect(res.status).toBe(422);
  });

  it("cria usuário com role PROFESSIONAL", async () => {
    const res = await request(app).post("/auth/register").send({
      email: "prof@habilita.com",
      password: "senha123",
      role: "PROFESSIONAL",
    });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe("PROFESSIONAL");
  });
});

describe("POST /auth/login", () => {
  it("retorna token para credenciais válidas", async () => {
    await request(app).post("/auth/register").send({ email: "login@test.com", password: "senha123" });
    const res = await request(app).post("/auth/login").send({ email: "login@test.com", password: "senha123" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe("login@test.com");
  });

  it("retorna 401 para senha incorreta", async () => {
    await request(app).post("/auth/register").send({ email: "user2@test.com", password: "certa" });
    const res = await request(app).post("/auth/login").send({ email: "user2@test.com", password: "errada" });
    expect(res.status).toBe(401);
  });

  it("retorna 401 para email inexistente", async () => {
    const res = await request(app).post("/auth/login").send({ email: "nao@existe.com", password: "qualquer" });
    expect(res.status).toBe(401);
  });
});

describe("GET /auth/me", () => {
  it("retorna dados do usuário autenticado", async () => {
    await request(app).post("/auth/register").send({ email: "me@test.com", password: "senha123" });
    const login = await request(app).post("/auth/login").send({ email: "me@test.com", password: "senha123" });
    const token = login.body.token;

    const res = await request(app).get("/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("me@test.com");
    expect(res.body.password).toBeUndefined();
  });

  it("retorna 401 sem token", async () => {
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
  });
});
