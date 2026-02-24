import Link from "next/link";
import { LovableLogo } from "@repo/ui/components/lovable-logo";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background py-12 px-4">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <LovableLogo size={28} />
          <span className="text-sm font-semibold text-foreground">Lovable</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">
            Home
          </Link>
          <a
            href="#features"
            className="hover:text-foreground transition-colors"
          >
            Features
          </a>
          <a href="#faq" className="hover:text-foreground transition-colors">
            FAQ
          </a>
          <Link
            href="/signin"
            className="hover:text-foreground transition-colors"
          >
            Sign In
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          &copy; 2026 Lovable. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
