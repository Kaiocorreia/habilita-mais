import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, signToken, verifyToken } from "../../src/lib/auth.js";

describe("auth helpers — testes unitários", () => {
  it("hashPassword gera hash diferente da senha original", async () => {
    const senha = "minhaSenha123";
    const hash = await hashPassword(senha);
    expect(hash).not.toBe(senha);
  });

  it("hashPassword gera hash com comprimento significativo", async () => {
    const hash = await hashPassword("qualquerSenha");
    expect(hash.length).toBeGreaterThan(20);
  });

  it("verifyPassword retorna true para senha correta", async () => {
    const hash = await hashPassword("abc123");
    const result = await verifyPassword("abc123", hash);
    expect(result).toBe(true);
  });

  it("verifyPassword retorna false para senha incorreta", async () => {
    const hash = await hashPassword("abc123");
    const result = await verifyPassword("errada", hash);
    expect(result).toBe(false);
  });

  it("signToken retorna uma string não vazia", () => {
    const token = signToken({ sub: 1, email: "a@b.com", role: "CANDIDATE" });
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });

  it("verifyToken decodifica payload corretamente", () => {
    const token = signToken({ sub: 42, email: "teste@email.com", role: "ADMIN" });
    const payload = verifyToken(token);
    expect(payload.sub).toBe(42);
    expect(payload.email).toBe("teste@email.com");
    expect(payload.role).toBe("ADMIN");
  });

  it("hashes distintos para mesma senha (salt aleatório)", async () => {
    const hash1 = await hashPassword("igual");
    const hash2 = await hashPassword("igual");
    expect(hash1).not.toBe(hash2);
  });
});
