import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"

import { QueryProvider } from "@/components/providers/query-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthGate } from "@/components/auth/auth-gate"
import { SidebarCollapseProvider } from "@/components/dashboard/sidebar-collapse-context"
import { FirstAccessDialog } from "@/components/auth/first-access-dialog"
import { Toaster } from "@/components/ui/sonner"
import "@eigenpal/docx-js-editor/styles.css"
import "./globals.css"

const _geist = Geist({ subsets: ["latin", "latin-ext"] })
const _geistMono = Geist_Mono({ subsets: ["latin", "latin-ext"] })

export const metadata: Metadata = {
  title: "Depclean - Sistema de Gestao Operacional",
  description: "Gestao completa de clientes, contratos, equipes e agendamentos",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider defaultTheme="light" storageKey="tasko-theme">
          <QueryProvider>
            <SidebarCollapseProvider>
              <AuthGate>
                {children}
                <FirstAccessDialog />
              </AuthGate>
            </SidebarCollapseProvider>
            <Toaster richColors position="top-right" />
          </QueryProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}

