import { beforeAll, afterAll, beforeEach } from "vitest";
import { execSync } from "node:child_process";
import { prisma } from "../src/lib/prisma.js";

beforeAll(() => {
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
});

beforeEach(async () => {
  // Limpa tabelas na ordem correta (respeitar FK)
  await prisma.review.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.professional.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
