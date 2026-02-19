import { Header } from './Header'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 overflow-auto min-h-0">{children}</main>
    </div>
  )
}
