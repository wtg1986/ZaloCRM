import type { Metadata } from "next";
// Self-host font (bundle trong node_modules) — KHÔNG fetch Google lúc build.
// Family: "Inter Variable" / "JetBrains Mono Variable" (xem globals.css --font-*).
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZaloCRM — Quản lý đa nick Zalo cho đội sale",
  description:
    "Hộp thư đa nick, chăm khách không sót, gửi hàng loạt an toàn, đo hiệu suất.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning className="h-full">
      <body className="min-h-full bg-background text-foreground antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>{children}</AuthProvider>
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
