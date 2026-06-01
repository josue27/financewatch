/**
 * Layout raíz de FinanceWatch.
 *
 * Define los metadatos, fuentes y la estructura HTML base.
 * Next.js App Router utiliza este componente como shell para todas las páginas.
 */

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinanceWatch — Seguimiento de Acciones",
  description:
    "Dashboard en tiempo real para seguir acciones bursátiles usando datos de Yahoo Finance.",
  keywords: ["acciones", "bolsa", "yahoo finance", "dashboard", "stock tracker"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen">
        {/* Encabezado fijo */}
        <header className="sticky top-0 z-50 border-b border-slate-700/50 bg-surface-dark/80 backdrop-blur-md">
          <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              {/* Icono de la app */}
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/20">
                <span className="text-lg">📈</span>
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-white">
                  FinanceWatch
                </h1>
                <p className="text-xs text-slate-500">
                  Datos en tiempo real · Yahoo Finance
                </p>
              </div>
            </div>
          </nav>
        </header>

        {/* Contenido principal */}
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>

        {/* Pie de página */}
        <footer className="border-t border-slate-700/50 py-4 text-center text-xs text-slate-600">
          FinanceWatch · Datos proporcionados por Yahoo Finance con fines educativos.
        </footer>
      </body>
    </html>
  );
}
