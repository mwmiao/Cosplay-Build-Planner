import { BottomNav, Sidebar } from "@/components/Nav";
import { requireUser } from "@/lib/auth";
import { signOut } from "../(auth)/actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex min-h-dvh">
      <Sidebar userName={user.name} isAdmin={user.isAdmin} signOut={signOut} />
      <main className="pb-safe-nav min-w-0 flex-1 md:pb-8">
        <div className="mx-auto w-full max-w-4xl px-4 py-4 md:px-8 md:py-8">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
