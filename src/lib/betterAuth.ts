import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { anonymous } from "better-auth/plugins";
import { db } from "./db";
import { sendEmail } from "./email";
import { appUrl, secureCookies } from "./env";
import { clearGuestKey, guestKey, moveGuestData } from "./guest";
import { getAuthSecret } from "./secrets";

export const SESSION_DAYS = 30;
export const RESET_TOKEN_MINUTES = 60;

function create() {
  return betterAuth({
    appName: "Cosplay Build Planner",
    secret: getAuthSecret(),
    baseURL: appUrl(),
    database: prismaAdapter(db, { provider: "sqlite" }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      autoSignIn: true,
      // Single-use, time-limited tokens stored server-side by Better Auth.
      resetPasswordTokenExpiresIn: RESET_TOKEN_MINUTES * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, token }) => {
        const link = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`;
        await sendEmail({
          to: user.email,
          subject: "Reset your Cosplay Build Planner password",
          text: `Someone asked to reset the password for this account.\n\nOpen this link within ${RESET_TOKEN_MINUTES} minutes to choose a new password (it works once):\n${link}\n\nIf this wasn't you, ignore this email; your password stays the same.`,
        });
      },
    },
    user: {
      additionalFields: {
        // Read-only for the app: input:false means sign-up/update requests can't set it.
        // Granted only with scripts/admin/set-admin on the server.
        role: { type: "string", required: false, defaultValue: "user", input: false },
      },
    },
    session: {
      expiresIn: SESSION_DAYS * 24 * 60 * 60,
      updateAge: 24 * 60 * 60, // sliding expiry, refreshed at most daily
    },
    // Better Auth's HTTP endpoints aren't mounted (the app calls auth.api from
    // server actions), so the app applies its own limits in lib/rateLimit.ts.
    rateLimit: { enabled: false },
    advanced: {
      cookiePrefix: "cbp",
      useSecureCookies: secureCookies(),
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for", "x-real-ip"] },
    },
    plugins: [
      // Guests ("try without an account"). When a guest registers or logs in,
      // their projects move to that account (images decrypted with the key from
      // their cookie); the plugin then deletes the guest user.
      anonymous({
        emailDomainName: "guest.invalid",
        generateName: () => "Guest",
        onLinkAccount: async ({ anonymousUser, newUser }) => {
          await moveGuestData(anonymousUser.user.id, newUser.user.id, guestKey());
          clearGuestKey();
        },
      }),
      nextCookies(),
    ],
  });
}

let instance: ReturnType<typeof create> | null = null;

/** Created on first use (never at build time, so no secret is generated during `next build`). */
export function getAuth() {
  if (!instance) instance = create();
  return instance;
}

