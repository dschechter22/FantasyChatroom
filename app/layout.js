export const metadata = {
  title: 'Fantasy Chatroom',
  description: '12 years of history',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <script dangerouslySetInnerHTML={{__html: `
          (function() {
            try {
              var theme = localStorage.getItem('fc-theme') || 'dark';
              document.body.setAttribute('data-theme', theme);
            } catch(e) {}
          })();
        `}} />
        {children}
      </body>
    </html>
  )
}
