import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

interface AppShellProps {
  title: string;
  children: ReactNode;
  back?: { to: string; label?: string };
}

export function AppShell({ title, children, back }: AppShellProps) {
  return (
    <main className="min-h-dvh bg-background text-foreground flex flex-col">
      <header className="px-6 pt-8 pb-4 flex items-center gap-4">
        {back ? (
          <Link
            to={back.to}
            aria-label={back.label ?? "뒤로 가기"}
            className="min-h-14 min-w-14 inline-flex items-center justify-center rounded-2xl border-2 border-border text-xl font-bold hover:bg-accent"
          >
            ←
          </Link>
        ) : (
          <div className="w-14" aria-hidden />
        )}
        <h1 className="text-2xl font-bold flex-1 text-center pr-14">{title}</h1>
      </header>
      <div className="flex-1 px-6 pb-10 flex flex-col">{children}</div>
    </main>
  );
}
