import React, { forwardRef } from 'react'
import { MRPPurchaseList } from '@/lib/api'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Props {
  data: {
    eventName: string
    eventDate: string | null
    purchaseList: MRPPurchaseList[]
  }
}

export const MRPPurchaseListPrint = forwardRef<HTMLDivElement, Props>(({ data }, ref) => {
  return (
    <div ref={ref} className="p-12 text-black bg-white min-h-screen">
      <div className="flex justify-between items-start mb-8 border-b-2 border-black pb-6">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tighter">Lista de Compras MRP</h1>
          <p className="text-lg font-medium">{data.eventName}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold uppercase tracking-widest">Fecha Evento</p>
          <p className="text-lg">{data.eventDate ? format(new Date(data.eventDate), 'dd/MM/yyyy', { locale: es }) : '---'}</p>
        </div>
      </div>

      <table className="w-full text-left border-collapse mb-12">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="py-3 px-2 text-xs font-bold uppercase">Ingrediente</th>
            <th className="py-3 px-2 text-xs font-bold uppercase text-right">Stock Disponible</th>
            <th className="py-3 px-2 text-xs font-bold uppercase text-right">Requerido</th>
            <th className="py-3 px-2 text-xs font-bold uppercase text-right">Cant. a Comprar</th>
          </tr>
        </thead>
        <tbody>
          {data.purchaseList.map((item, idx) => (
            <tr key={idx} className="border-b border-gray-300">
              <td className="py-4 px-2">
                <p className="font-bold">{item.item_name}</p>
                <p className="text-[10px] text-gray-500 uppercase">{item.uom_name}</p>
              </td>
              <td className="py-4 px-2 text-right font-medium">
                {item.qty_available.toFixed(2)}
              </td>
              <td className="py-4 px-2 text-right font-medium text-blue-600">
                {item.qty_needed.toFixed(2)}
              </td>
              <td className="py-4 px-2 text-right">
                <div className="inline-block w-32 border-b-2 border-dotted border-black h-8 text-right pr-2">
                   <span className="font-bold text-red-600">{item.qty_deficit > 0 ? item.qty_deficit.toFixed(2) : '0.00'}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-20 flex justify-between">
        <div className="text-center w-64">
          <div className="border-b border-black mb-2" />
          <p className="text-xs font-bold uppercase">Firma Almacén</p>
        </div>
        <div className="text-center w-64">
          <div className="border-b border-black mb-2" />
          <p className="text-xs font-bold uppercase">Firma Compras</p>
        </div>
      </div>

      <div className="fixed bottom-12 left-12 right-12 text-[10px] text-gray-400 flex justify-between">
        <p>Generado por VERUM MRP System</p>
        <p>{format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
      </div>
    </div>
  )
})

MRPPurchaseListPrint.displayName = 'MRPPurchaseListPrint'
