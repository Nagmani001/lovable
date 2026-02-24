"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { LovableLogo } from "@repo/ui/components/lovable-logo";

export function Navbar() {
  const { setTheme, resolvedTheme } = useTheme();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <Link href="/" className="flex items-center gap-2">
        <LovableLogo size={32} />
        <span className="text-lg font-semibold text-foreground tracking-tight">
          Lovable
        </span>
      </Link>
      <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
        <a href="#features" className="hover:text-foreground transition-colors">
          Features
        </a>
        <a href="#faq" className="hover:text-foreground transition-colors">
          FAQ
        </a>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="w-9 h-9 rounded-lg border border-border bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Toggle theme"
        >
          <Sun className="size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90 absolute" />
          <Moon className="size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0 absolute" />
        </button>
        <Link
          href="/signin"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 transition-opacity font-medium"
        >
          Get Started
        </Link>
      </div>
    </nav>
  );
}
