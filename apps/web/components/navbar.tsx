"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import {
  Sun,
  Moon,
  Rocket,
  Loader2,
  Github,
  Database,
  HelpCircle,
} from "lucide-react";
import { LovableLogo } from "@repo/ui/components/lovable-logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { authClient } from "@/lib/auth";
import { deployProject } from "@/lib/api";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export function Navbar() {
  const { setTheme, resolvedTheme } = useTheme();
  const { data: session } = authClient.useSession();
  const pathname = usePathname();
  const user = session?.user as
    | {
        name?: string | null;
        email?: string | null;
        imageUrl?: string | null;
        image?: string | null;
      }
    | undefined;
  const imageUrl = user?.imageUrl || user?.image || null;
  const userInitial = (user?.name || user?.email || "U")
    .trim()
    .charAt(0)
    .toUpperCase();

  const router = useRouter();
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);

  const projectId = useMemo(() => {
    if (!pathname || !pathname.startsWith("/project/")) return null;
    const segments = pathname.split("/").filter(Boolean);
    return segments[1] ?? null;
  }, [pathname]);

  const handleDeploy = async () => {
    if (!projectId) return;
    try {
      setIsDeploying(true);
      const result = await deployProject(projectId);
      setDeployedUrl(result.deployedUrl);
    } catch (err) {
      console.error("Deploy failed:", err);
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <Link href="/" className="flex items-center gap-2">
        <LovableLogo size={32} />
        <span className="text-lg font-semibold text-foreground tracking-tight">
          Lovable
        </span>
      </Link>
      <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground"></div>
      <div className="flex items-center gap-3">
        {projectId ? (
          <div className="hidden sm:flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="w-9 h-9 rounded-lg border border-border bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Connect GitHub"
                >
                  <Github className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-80 p-0 border border-border rounded-xl shadow-lg overflow-hidden"
              >
                <div className="p-4 space-y-2">
                  <h3 className="font-semibold text-foreground">GitHub</h3>
                  <p className="text-sm text-muted-foreground leading-snug">
                    Sync your project 2-way with GitHub to collaborate at
                    source.
                  </p>
                </div>
                <div className="border-t border-border p-3 flex items-center justify-between bg-muted/40">
                  <HelpCircle className="size-4 text-muted-foreground" />
                  <button className="px-3 py-1.5 text-[13px] bg-background border border-border text-foreground rounded-md hover:bg-muted font-medium flex items-center gap-1.5 transition-colors">
                    <Github className="size-3.5" /> Connect GitHub
                  </button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="w-9 h-9 rounded-lg border border-border bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Connect Supabase"
                >
                  <Database className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-80 p-0 border border-border rounded-xl shadow-lg overflow-hidden"
              >
                <div className="p-4 space-y-2">
                  <h3 className="font-semibold text-foreground">Supabase</h3>
                  <p className="text-sm text-muted-foreground leading-snug">
                    Connect your project to a Supabase backend for reliable
                    database and auth.
                  </p>
                </div>
                <div className="border-t border-border p-3 flex items-center justify-between bg-muted/40">
                  <HelpCircle className="size-4 text-muted-foreground" />
                  <button className="px-3 py-1.5 text-[13px] bg-background border border-border text-foreground rounded-md hover:bg-muted font-medium flex items-center gap-1.5 transition-colors">
                    <Database className="size-3.5" /> Connect Supabase
                  </button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            {deployedUrl ? (
              <a
                href={deployedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline max-w-[220px] truncate"
                title={deployedUrl}
              >
                {deployedUrl}
              </a>
            ) : null}
            <button
              onClick={handleDeploy}
              disabled={isDeploying}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isDeploying ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Rocket className="h-3.5 w-3.5" />
              )}
              Deploy
            </button>
          </div>
        ) : null}
        <button
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="w-9 h-9 rounded-lg border border-border bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Toggle theme"
        >
          <Sun className="size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90 absolute" />
          <Moon className="size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0 absolute" />
        </button>
        {session ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="size-9 rounded-full border border-border bg-secondary text-foreground overflow-hidden flex items-center justify-center"
                aria-label="Open user menu"
              >
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={user?.name ?? "User avatar"}
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-semibold">{userInitial}</span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="py-2">
                <div className="text-sm font-medium text-foreground">
                  {user?.name ?? "Account"}
                </div>
                {user?.email ? (
                  <div className="text-xs text-muted-foreground">
                    {user.email}
                  </div>
                ) : null}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard">Dashboard</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/profile">Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/billing">Billing</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={async () => {
                  await authClient.signOut();
                  router.push("/signin");
                }}
              >
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <>
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
          </>
        )}
      </div>
    </nav>
  );
}
