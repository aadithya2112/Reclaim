"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return <Tooltip><TooltipTrigger render={<Button variant="outline" size="icon" aria-label="Toggle color theme" onClick={() => setTheme(dark ? "light" : "dark")} />}>
    <Sun className="hidden size-4 dark:block" /><Moon className="size-4 dark:hidden" />
  </TooltipTrigger><TooltipContent>Toggle theme <kbd className="ml-1 rounded bg-background/15 px-1">D</kbd></TooltipContent></Tooltip>;
}
