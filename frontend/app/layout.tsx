import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/Sidebar'
import { BottomNav } from '@/components/BottomNav'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'IngredIQ — Ingredient Intelligence',
  description: 'Know what\'s in your food. Personalised ingredient safety analysis matched to your health profile.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={geist.className}>
        <div className="app-shell">
          <Sidebar />
          <main className="app-main">
            {children}
          </main>
        </div>
        <BottomNav />
      </body>
    </html>
  )
}
