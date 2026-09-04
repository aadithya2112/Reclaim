"use client";

import Link from "next/link";
import { Menu, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { EvidenceBadge, type EvidenceKind } from "@/components/app/evidence-badge";

type AppHeaderProps = {
  active: "command" | "replay";
  environment: string;
  environmentKind: EvidenceKind;
  onReset?: () => void;
  resetting?: boolean;
};

const links = [
  { href: "/", label: "Command center", key: "command" },
  { href: "/#queue", label: "Decision queue", key: "queue" },
  { href: "/collection", label: "Decision replay", key: "replay" },
  { href: "/#evidence", label: "Evidence lab", key: "evidence" },
] as const;

export function AppHeader({ active, environment, environmentKind, onReset, resetting }: AppHeaderProps) {
  const navigation = (
    <nav aria-label="Primary navigation" className="flex flex-col gap-1 xl:flex-row xl:items-center">
      {links.map((link) => (
        <Button key={link.key} variant={link.key === active ? "secondary" : "ghost"} size="sm" nativeButton={false} render={<Link href={link.href} />}>
          {link.label}
        </Button>
      ))}
    </nav>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1480px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-7">
          <Link href="/" className="flex items-center gap-2.5 text-sm font-semibold tracking-tight" aria-label="Recoup command center">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">R</span>
            <span className="hidden sm:inline">recoup</span>
          </Link>
          <div className="hidden xl:block">{navigation}</div>
        </div>
        <div className="flex items-center gap-2">
          <EvidenceBadge kind={environmentKind}>{environment}</EvidenceBadge>
          {onReset ? <Button variant="outline" size="sm" onClick={onReset} disabled={resetting} aria-label={resetting ? "Resetting demo" : "Reset demo"}><RotateCcw /><span className="hidden sm:inline">{resetting ? "Resetting…" : "Reset demo"}</span></Button> : null}
          <Sheet>
            <SheetTrigger render={<Button variant="outline" size="icon" className="xl:hidden" aria-label="Open navigation" />}><Menu /></SheetTrigger>
            <SheetContent side="right" className="w-[300px]">
              <SheetHeader><SheetTitle>Recoup</SheetTitle><SheetDescription>Revenue recovery workspace</SheetDescription></SheetHeader>
              <div className="px-3">{navigation}</div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
