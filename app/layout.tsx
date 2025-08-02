import type React from "react"
import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Cosmic Plinko - #BovadaPlinkoChallenge",
  description: "Professional Cosmic Plinko game with realistic physics and immersive audio",
  manifest: "/manifest.json",
  icons: {
    apple: "/icon-192x192.png",
  },
  themeColor: "#3b82f6",
    generator: 'v0.dev'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
