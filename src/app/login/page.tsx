import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Log in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isAuthenticated()) redirect("/projects");
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="card w-full max-w-sm p-6">
        <img src="/icon.svg" alt="" className="mx-auto mb-4 h-14 w-14" />
        <h1 className="mb-1 text-center text-xl font-bold">Cosplay Build Planner</h1>
        <p className="mb-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Enter your password to continue.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
