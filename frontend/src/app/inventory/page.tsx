'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import { ChefHat, Package, ArrowLeft, ArrowRight } from 'lucide-react'

export default function InventoryDashboardPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-bg text-text-primary pb-24 flex flex-col justify-between">
      <div>
        {/* Header */}
        <header className="sticky top-0 z-10 bg-surface/80 backdrop-blur-md border-b border-border px-4 h-14 flex items-center gap-3">
          <button 
            onClick={() => router.push('/dashboard')} 
            className="p-2 -ml-2 text-text-secondary hover:text-text-primary transition-colors"
            title="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-lg text-text-primary tracking-tight">Inventario</h1>
        </header>

        {/* Content */}
        <main className="p-6 max-w-lg mx-auto space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-black tracking-tight bg-gradient-to-r from-primary to-primary-hover bg-clip-text text-transparent">
              Tareas de Conteo
            </h2>
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Selecciona el tipo de conteo que deseas realizar
            </p>
          </div>

          <div className="grid gap-4">
            {/* Card 1: Artículos */}
            <button
              onClick={() => router.push('/inventory/count')}
              className="w-full text-left bg-surface border border-border rounded-3xl p-6 hover:border-primary/50 transition-all duration-300 group shadow-sm flex items-center gap-5 hover:shadow-lg hover:shadow-primary/5 active:scale-[0.98] cursor-pointer"
            >
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-text-inverse transition-all duration-300 shadow-inner shrink-0">
                <Package className="w-7 h-7" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-black text-text-primary text-lg tracking-tight group-hover:text-primary transition-colors">
                    Conteo de Artículos
                  </h3>
                  <ArrowRight className="w-4 h-4 text-text-secondary opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
                </div>
                <p className="text-xs text-text-secondary font-medium leading-relaxed">
                  Registra cantidades físicas de materia prima, insumos y productos terminados.
                </p>
              </div>
            </button>

            {/* Card 2: Utensilios */}
            <button
              onClick={() => router.push('/inventory/utensils')}
              className="w-full text-left bg-surface border border-border rounded-3xl p-6 hover:border-success/50 transition-all duration-300 group shadow-sm flex items-center gap-5 hover:shadow-lg hover:shadow-success/5 active:scale-[0.98] cursor-pointer"
            >
              <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center text-success group-hover:bg-success group-hover:text-text-inverse transition-all duration-300 shadow-inner shrink-0">
                <ChefHat className="w-7 h-7" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-black text-text-primary text-lg tracking-tight group-hover:text-success transition-colors">
                    Conteo de Utensilios
                  </h3>
                  <ArrowRight className="w-4 h-4 text-text-secondary opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
                </div>
                <p className="text-xs text-text-secondary font-medium leading-relaxed">
                  Registra vajilla, cubiertos, herramientas de cocina y control de activos.
                </p>
              </div>
            </button>
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  )
}
