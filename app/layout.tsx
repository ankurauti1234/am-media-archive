import { Geist, Geist_Mono } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"
import { AuthProvider } from "@/lib/auth-context"
import { TimezoneProvider } from "@/lib/timezone-context"
import type { Metadata, Viewport } from "next"

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "Media Archive Dashboard",
  description:
    "Monitor and browse channel video recordings and telemetry CSV reports in real-time.",
}

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontSans.variable,
        fontMono.variable
      )}
    >
      <body>
        <AuthProvider>
          <ThemeProvider>
            <TimezoneProvider>
              {children}
            </TimezoneProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}