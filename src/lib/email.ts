import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";

/**
 * Outgoing email (only used for password-reset links).
 *
 * - SMTP_HOST (+ SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_SECURE, EMAIL_FROM): real delivery.
 * - EMAIL_OUTBOX_DIR: TESTING ONLY — messages are written as JSON files to that
 *   folder instead of being sent. Never set this in production.
 * - Neither: email is unavailable and the UI says so (nothing pretends to send).
 */
export type EmailMode = "smtp" | "outbox" | "off";

export function emailMode(): EmailMode {
  if (process.env.SMTP_HOST?.trim()) return "smtp";
  if (process.env.EMAIL_OUTBOX_DIR?.trim()) return "outbox";
  return "off";
}

export function emailConfigured(): boolean {
  return emailMode() !== "off";
}

export class EmailUnavailableError extends Error {}

export async function sendEmail(message: { to: string; subject: string; text: string }): Promise<void> {
  const mode = emailMode();
  const from = process.env.EMAIL_FROM?.trim() || process.env.SMTP_USER?.trim() || "cosplay-planner@localhost";

  if (mode === "smtp") {
    const port = Number(process.env.SMTP_PORT ?? 587);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" } : undefined,
    });
    await transport.sendMail({ from, ...message });
    return;
  }

  if (mode === "outbox") {
    const dir = path.resolve(process.env.EMAIL_OUTBOX_DIR as string);
    await mkdir(dir, { recursive: true });
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
    await writeFile(path.join(dir, name), JSON.stringify({ from, ...message }, null, 2));
    return;
  }

  throw new EmailUnavailableError("Email is not configured");
}
