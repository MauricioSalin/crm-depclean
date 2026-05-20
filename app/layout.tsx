import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"

import { QueryProvider } from "@/components/providers/query-provider"
import { PwaProvider } from "@/components/providers/pwa-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthGate } from "@/components/auth/auth-gate"
import { SidebarCollapseProvider } from "@/components/dashboard/sidebar-collapse-context"
import { FirstAccessDialog } from "@/components/auth/first-access-dialog"
import { Toaster } from "@/components/ui/sonner"
import "@eigenpal/docx-js-editor/styles.css"
import "./globals.css"

const _geist = Geist({ subsets: ["latin", "latin-ext"] })
const _geistMono = Geist_Mono({ subsets: ["latin", "latin-ext"] })

const APP_NAME = "Depclean CRM"
const APP_DESCRIPTION = "Gestão completa de clientes, contratos, equipes e agendamentos"

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: "Depclean CRM - Sistema de Gestão Operacional",
  description: APP_DESCRIPTION,
  generator: "v0.app",
  manifest: "/manifest.webmanifest",
  formatDetection: {
    telephone: false,
  },
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: "default",
  },
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
      {
        url: "/favicon.png",
      },
    ],
    shortcut: "/favicon.png",
    apple: "/apple-icon.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#ffffff",
    "msapplication-tap-highlight": "no",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#ffffff" },
  ],
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
            <PwaProvider />
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

