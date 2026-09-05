import type { Metadata } from "next";
import "./globals.css";
import { Outfit } from "next/font/google";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/app/theme-provider";

const outfit = Outfit({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Recoup — Revenue Recovery",
  description: "Razorpay receivables recovery technical spike",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning className={cn("font-sans", outfit.variable)}>
      <body><ThemeProvider><TooltipProvider>{children}</TooltipProvider></ThemeProvider></body>
    </html>
  );
}
