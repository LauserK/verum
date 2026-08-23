import React from 'react'

export const metadata = {
  title: 'VERUM POS — Punto de Venta',
  description: 'Sistema Punto de Venta ágil y táctil para restaurantes y comercios',
}

export default function PosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="h-screen w-screen overflow-hidden bg-bg text-text-primary flex flex-col antialiased selection:bg-primary selection:text-text-inverse font-sans select-none">
      {children}
    </div>
  )
}