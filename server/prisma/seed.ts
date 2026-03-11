import "dotenv/config";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function randomPassword() {
  return crypto.randomBytes(9).toString("base64url"); // ~12 chars
}

async function main() {
  const email = process.env.ADMIN_DEFAULT_EMAIL || "admin@example.com";

  const password = randomPassword();
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await prisma.admin.findUnique({ where: { email } });

  if (existing) {
    await prisma.admin.update({
      where: { email },
      data: { passwordHash },
    });
    console.log("Admin password reset.");
    console.log(`Email: ${email}`);
    console.log(`New Password: ${password}`);
    return;

  }

  await prisma.admin.create({
    data: { email, passwordHash },
  });

  console.log("Seeded admin account.");
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);

}


main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

