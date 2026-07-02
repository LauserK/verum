import React, { forwardRef } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export interface DispatchItem {
  item_name: string
  uom_name: string
  qty: number
  qty_available?: number
  qty_deficit?: number
  source: 'production' | 'stock' | 'ingredient'
}

interface Props {
  data: {
    eventName: string
    eventDate: string | null
    tentativeProductionDate: string | null
    dispatchList: DispatchItem[]
    generatedBy?: string
  }
}

export const MRPDispatchListPrint = forwardRef<HTMLDivElement, Props>(({ data }, ref) => {
  const ingredients = [...data.dispatchList].sort((a, b) => a.item_name.localeCompare(b.item_name))

  return (
    <div ref={ref} className="p-12 text-black bg-white min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-start mb-8 border-b-2 border-black pb-6">
        <div>
          <h1 className="text-4xl font-extrabold uppercase tracking-tighter text-black mb-1">VERUM</h1>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Lista de Despacho — Logística de Catering</p>
          <p className="text-lg font-bold mt-2 text-gray-800">{data.eventName}</p>
        </div>
        <div className="text-right space-y-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Fecha del Evento</p>
            <p className="text-sm font-semibold mt-0.5">{data.eventDate ? format(new Date(data.eventDate), 'dd/MM/yyyy', { locale: es }) : '---'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Fecha Tentativa Prod.</p>
            <p className="text-sm font-semibold mt-0.5">{data.tentativeProductionDate ? format(new Date(data.tentativeProductionDate), 'dd/MM/yyyy', { locale: es }) : '---'}</p>
          </div>
        </div>
      </div>

      {/* Ingredients Table */}
      <table className="w-full text-left border-collapse mb-12">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="py-3 px-2 text-xs font-bold uppercase">Ingrediente</th>
            <th className="py-3 px-2 text-xs font-bold uppercase text-center">U.M.</th>
            <th className="py-3 px-2 text-xs font-bold uppercase text-right">Cantidad Total</th>
            <th className="py-3 px-2 text-xs font-bold uppercase text-center">Estado Stock</th>
            <th className="py-3 px-2 text-xs font-bold uppercase text-center w-28">✓ Cargado</th>
          </tr>
        </thead>
        <tbody>
          {ingredients.map((item, idx) => (
            <tr key={idx} className="border-b border-gray-200">
              <td className="py-3 px-2">
                <p className="font-semibold text-sm">{item.item_name}</p>
              </td>
              <td className="py-3 px-2 text-center">
                <span className="text-[10px] font-bold text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-300/60 uppercase tracking-wide">
                  {item.uom_name}
                </span>
              </td>
              <td className="py-3 px-2 text-right font-bold text-gray-900 text-sm">
                {(Math.ceil(item.qty * 100) / 100).toFixed(2)}
              </td>
              <td className="py-3 px-2 text-center">
                {item.qty_deficit !== undefined && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    item.qty_deficit > 0
                      ? 'bg-red-50 text-red-600 border border-red-200'
                      : 'bg-green-50 text-green-700 border border-green-200'
                  }`}>
                    {item.qty_deficit > 0
                      ? `Faltan ${(Math.ceil(item.qty_deficit * 100) / 100).toFixed(2)}`
                      : 'En stock'}
                  </span>
                )}
              </td>
              <td className="py-3 px-2">
                <div className="mx-auto w-16 h-6 border-2 border-gray-300 rounded" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer */}
      <div className="fixed bottom-12 left-12 right-12 text-[10px] text-gray-400 flex justify-between border-t border-gray-200 pt-4">
        <p>Generado por: <span className="font-bold text-gray-600">{data.generatedBy || 'Sistema'}</span></p>
        <p>Fecha de Impresión: <span className="font-bold text-gray-600">{format(new Date(), 'dd/MM/yyyy HH:mm')}</span></p>
      </div>
    </div>
  )
})

MRPDispatchListPrint.displayName = 'MRPDispatchListPrint'
