import { GuestBanner } from "@/components/GuestBanner";
import { BottomNav, Sidebar } from "@/components/Nav";
import { VisitorShell } from "@/components/VisitorShell";
import { adminCounts } from "@/lib/adminCounts";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/lib/auth";
import { signOut } from "../(auth)/actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Visitors without an account only get here for the Projects page (see
  // middleware); every private page still checks the session itself.
  const user = await getCurrentUser();
  if (!user) return <VisitorShell loginHref="/login">{children}</VisitorShell>;
  const adminBadge = user.isAdmin ? badge(await adminCounts()) : 0;
  return (
    <div className="flex min-h-dvh">
      <Sidebar userName={user.name} isAdmin={user.isAdmin} isGuest={user.isGuest} adminBadge={adminBadge} signOut={signOut} />
      <main className="pb-safe-nav min-w-0 flex-1 md:pb-8">
        <div className="mx-auto w-full max-w-4xl px-4 py-4 md:px-8 md:py-8">
          {user.guestExpiresAt ? <GuestBanner expiresAt={user.guestExpiresAt} t={getI18n().t} /> : null}
          {children}
        </div>
      </main>
      <BottomNav adminBadge={adminBadge} />
    </div>
  );
}

const badge = (c: { toReview: number; unread: number }) => c.unread + c.toReview;
