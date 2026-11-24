import type { Metadata } from 'next'
import { Inter, Sora, Chivo, Roboto_Condensed } from 'next/font/google'
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

const chivo = Chivo({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  variable: '--font-chivo',
  display: 'swap',
})

const slipFont = Roboto_Condensed({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-slip',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Predisha: Football intelligence',
    template: '%s · Predisha',
  },
  description:
    'Explore fixtures, competitions, team form and transparent Predisha probability analysis. Model estimates, not bookmaker prices or guaranteed outcomes.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable} ${chivo.variable} ${slipFont.variable}`}>
      <body className="min-h-screen bg-background font-sans text-main-text antialiased">
        <ViewerProvider>
          <LanguageProvider>{children}</LanguageProvider>
        </ViewerProvider>
      </body>
    </html>
  )
}

export const instant = false
