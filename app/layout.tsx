import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mundial Homio 2026',
  description: 'La quiniela del Mundial 2026. Predice resultados, gana puntos y compite con tus amigos y familia.',
  openGraph: {
    title: 'Mundial Homio 2026',
    description: 'La quiniela del Mundial 2026. Predice resultados, gana puntos y compite con tus amigos y familia.',
    url: 'https://mundial.homio.ca',
    siteName: 'Mundial Homio 2026',
    locale: 'es_MX',
    type: 'website',
  },
  icons: { icon: '/favicon.png', apple: '/favicon.png' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
