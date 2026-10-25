// Admin password reset (for when email isn't configured).
//
//   docker exec -it cosplay-planner node scripts/reset-password.js --email user@example.com
//
// Generates a new random password, prints it once, stores only its hash
// (Better Auth's scrypt format) and signs the user out everywhere. Pass
// --password "..." to set a specific one instead (it ends up in shell history).
import { randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { arg, fail, prisma } from "./common";

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  if (!email) fail("Pass the account: --email user@example.com");
  const given = arg("password");
  if (given !== undefined && given.length < 10) fail("Use at least 10 characters.");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) fail(`No account with the email ${email}.`);
  const account = await prisma.account.findFirst({ where: { userId: user.id, providerId: "credential" } });
  if (!account) fail("That account has no password login.");

  const password = given ?? randomBytes(12).toString("base64url");
  const hash = await hashPassword(password);
  await prisma.$transaction([
    prisma.account.update({ where: { id: account.id }, data: { password: hash } }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
    // Also void this user's outstanding reset links (Better Auth stores the user id as the value).
    prisma.verification.deleteMany({ where: { identifier: { startsWith: "reset-password:" }, value: user.id } }),
  ]);

  console.log(`\nPassword reset for ${user.name} <${user.email}>. All their sessions were signed out.`);
  if (!given) console.log(`New password (shown once): ${password}\nAsk them to change it under Account.\n`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
