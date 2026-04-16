import { LayoutProvider } from '../hooks/LayoutContext'
import './globals.css'

export const metadata = {
  title: 'Fantasy Chatroom',
  description: 'Fantasy football league history and stats',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <LayoutProvider>
          {children}
        </LayoutProvider>
      </body>
    </html>
  )
}
