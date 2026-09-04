import type { Metadata } from "next";
import "./globals.css";
import { Outfit } from "next/font/google";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";

const outfit = Outfit({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Recoup — Revenue Recovery",
  description: "Razorpay receivables recovery technical spike",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={cn("font-sans", outfit.variable)}>
      <body><TooltipProvider>{children}</TooltipProvider></body>
    </html>
  );
}
