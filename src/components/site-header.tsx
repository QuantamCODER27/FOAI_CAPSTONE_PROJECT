import { Link } from "@tanstack/react-router";
import { Shield } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/50 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="group flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
            <Shield className="h-5 w-5 text-primary-foreground" />
            <div className="absolute inset-0 rounded-lg bg-primary/40 blur-md transition-opacity group-hover:opacity-100 opacity-0" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              ai · v1
            </span>
            <span className="text-lg font-bold tracking-tight">
              News<span className="text-gradient">Verdict</span>
            </span>
          </div>
        </Link>
        <nav className="flex items-center gap-1 font-mono text-xs uppercase tracking-wider">
          <Link
            to="/"
            className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            activeProps={{ className: "rounded-md px-3 py-2 text-foreground bg-secondary" }}
            activeOptions={{ exact: true }}
          >
            Analyze
          </Link>
          <Link
            to="/history"
            className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            activeProps={{ className: "rounded-md px-3 py-2 text-foreground bg-secondary" }}
          >
            History
          </Link>
          <Link
            to="/about"
            className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            activeProps={{ className: "rounded-md px-3 py-2 text-foreground bg-secondary" }}
          >
            About
          </Link>
        </nav>
      </div>
    </header>
  );
}
