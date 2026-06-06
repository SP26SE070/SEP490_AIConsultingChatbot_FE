"use client";

import { useEffect, useState } from "react";
import { ProfileAppHeader } from "@/components/layout/ProfileAppHeader";
import { DashboardAnimatedBackground } from "@/components/ui/DashboardAnimatedBackground";
import { getStoredUser } from "@/lib/auth-store";
import { getPortalAccent, type PortalAccent } from "@/lib/portal-accent";
import { cn } from "@/lib/utils/cn";

interface ProfilePageShellProps {
  children: React.ReactNode;
}

export function ProfilePageShell({ children }: ProfilePageShellProps) {
  const [accent, setAccent] = useState<PortalAccent>("emerald");

  useEffect(() => {
    setAccent(getPortalAccent(getStoredUser()?.roles));
  }, []);

  return (
    <div
      data-portal-accent={accent}
      className="profile-portal-shell flex h-dvh max-h-dvh w-full min-w-0 flex-col overflow-hidden bg-transparent dark:bg-zinc-950"
    >
      <div className="pointer-events-none fixed inset-0 z-0">
        <DashboardAnimatedBackground accent={accent} />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <ProfileAppHeader />
        <main
          className={cn(
            "scrollbar-chat-hidden relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain"
          )}
        >
          <div className="relative z-[1] mx-auto w-full min-w-0 max-w-6xl px-4 py-6 pb-10 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
