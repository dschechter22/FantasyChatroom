export const metadata = {
  title: 'Fantasy League',
  description: '11 years of history',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#0f0f0f', color: '#f0f0f0' }}>
        {children}
      </body>
    </html>
  )
}
