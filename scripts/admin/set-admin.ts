// Grant or remove the admin role (Community moderation).
//
//   docker exec cosplay-planner node scripts/set-admin.js --email you@example.com
//   docker exec cosplay-planner node scripts/set-admin.js --email you@example.com --remove
//
// Admin can only be granted here, by someone with access to the server — never
// through the app, and never automatically by email (anyone could register an
// unverified email address first).
import { arg, fail, flag, prisma } from "./common";

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  if (!email) fail("Pass the account: --email you@example.com");
  const remove = flag("remove");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) fail(`No account with the email ${email}. Register in the app first.`);
  await prisma.user.update({ where: { id: user.id }, data: { role: remove ? "user" : "admin" } });
  // Sign them out so the new role applies immediately on their next login.
  await prisma.session.deleteMany({ where: { userId: user.id } });
  console.log(`\n${user.name} <${user.email}> is ${remove ? "no longer an admin" : "now an admin"}. They need to log in again.\n`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
