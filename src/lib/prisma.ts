import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../../generated/prisma/client.js";

const rawUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const url = rawUrl.replace(/^file:/, "");
const adapter = new PrismaBetterSqlite3({ url });
export const prisma = new PrismaClient({ adapter });
