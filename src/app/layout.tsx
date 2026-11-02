import type { Metadata } from 'next'
import { Inter, Sora } from 'next/font/google'
import './globals.css'
import { LanguageProvider } from '@/components/ui/language-provider'
import { ViewerProvider } from '@/components/ui/viewer-provider'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Predisha — AI-assisted football analysis',
    template: '%s · Predisha',
  },
  description:
    'Statistically grounded football predictions with transparent probabilities, data timestamps, and honest performance tracking. Not a bookmaker.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable}`}>
      <body className="min-h-screen bg-background font-sans text-main-text antialiased">
        <ViewerProvider>
          <LanguageProvider>{children}</LanguageProvider>
        </ViewerProvider>
      </body>
    </html>
  )
}

export const instant = false
