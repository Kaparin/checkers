import { Header } from '@/components/layout/header'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="max-w-6xl mx-auto px-4 py-8">
        {children}
      </main>
    </>
  )
}
