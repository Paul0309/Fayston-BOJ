import "./globals.css";

export const metadata = {
  title: "USACO School",
  description: "USACO-style contest training platform",
};

// Runs before React hydrates to prevent theme flash
const themeScript = `(function(){var t=localStorage.getItem('usaco-theme')||'dark';document.documentElement.setAttribute('data-theme',t);})();`;

export default function RootLayout({ children }) {
  const year = new Date().getFullYear();

  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning className="site-body">
        <div className="site-shell">
          <main className="site-main">{children}</main>
          <footer className="site-footer">
            <div className="site-footer-inner">
              <p className="site-footer-brand">USACO School</p>
              <p className="site-footer-copy">Algorithm training platform · {year}</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
