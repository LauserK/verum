'use client';

import React, { forwardRef } from 'react';
import { StockMovement, InventoryItem, Warehouse } from '@/lib/api';

interface MovementPrintProps {
  type: 'receipt' | 'issue';
  data: {
    id?: string;
    warehouseName: string;
    supplier?: string;
    receiptNumber?: string;
    reason?: string;
    notes?: string;
    createdAt: string;
    lines: Array<{
      itemName: string;
      qty: number;
      uom?: string;
      cost?: number;
      lot?: string;
    }>;
  };
}

export const MovementPrint = forwardRef<HTMLDivElement, MovementPrintProps>(({ type, data }, ref) => {
  const isReceipt = type === 'receipt';
  
  return (
    <div ref={ref} className="p-10 text-black bg-white min-h-screen font-sans">
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-gray-900 pb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter uppercase mb-1">VERUM</h1>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Portal de Gestión Operativa</p>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold uppercase">{isReceipt ? 'Comprobante de Ingreso' : 'Comprobante de Egreso'}</h2>
          <p className="text-sm font-mono text-gray-600 mt-1">Ref: {data.receiptNumber || data.id?.slice(0,8).toUpperCase() || '---'}</p>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-8 my-8 text-sm">
        <div className="space-y-2">
          <p><span className="font-bold uppercase text-[10px] text-gray-500 block">Almacén</span> 
             <span className="text-base font-semibold">{data.warehouseName}</span></p>
          {isReceipt ? (
            <p><span className="font-bold uppercase text-[10px] text-gray-500 block">Proveedor</span> 
               <span className="text-base font-semibold">{data.supplier || 'N/A'}</span></p>
          ) : (
            <p><span className="font-bold uppercase text-[10px] text-gray-500 block">Motivo</span> 
               <span className="text-base font-semibold uppercase">{data.reason || 'Egreso General'}</span></p>
          )}
        </div>
        <div className="space-y-2 text-right">
          <p><span className="font-bold uppercase text-[10px] text-gray-500 block">Fecha de Registro</span> 
             <span className="text-base font-semibold">{new Date(data.createdAt).toLocaleString()}</span></p>
          <p><span className="font-bold uppercase text-[10px] text-gray-500 block">Nº Documento</span> 
             <span className="text-base font-semibold">{data.receiptNumber || 'S/N'}</span></p>
        </div>
      </div>

      {/* Table */}
      <div className="mt-10">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-900">
              <th className="py-3 text-[10px] font-bold uppercase tracking-widest">Descripción del Artículo</th>
              <th className="py-3 text-[10px] font-bold uppercase tracking-widest text-center">Lote</th>
              <th className="py-3 text-[10px] font-bold uppercase tracking-widest text-right">Cantidad</th>
              {isReceipt && <th className="py-3 text-[10px] font-bold uppercase tracking-widest text-right">Costo Unit.</th>}
              {isReceipt && <th className="py-3 text-[10px] font-bold uppercase tracking-widest text-right">Total</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.lines.map((line, index) => (
              <tr key={index}>
                <td className="py-4">
                    <p className="font-bold">{line.itemName}</p>
                    <p className="text-[10px] text-gray-500 uppercase">{line.uom || 'Unidad Base'}</p>
                </td>
                <td className="py-4 text-center font-mono text-sm">{line.lot || '---'}</td>
                <td className="py-4 text-right font-bold">{line.qty.toFixed(2)}</td>
                {isReceipt && <td className="py-4 text-right font-mono text-sm">${(line.cost || 0).toFixed(2)}</td>}
                {isReceipt && <td className="py-4 text-right font-bold font-mono">${((line.qty) * (line.cost || 0)).toFixed(2)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Total Section for Receipts */}
      {isReceipt && (
          <div className="mt-6 flex justify-end">
              <div className="w-64 bg-gray-50 p-4 border border-gray-200 rounded-lg">
                  <div className="flex justify-between items-center font-black text-lg">
                      <span>TOTAL VALORIZADO</span>
                      <span>${data.lines.reduce((acc, l) => acc + (l.qty * (l.cost || 0)), 0).toFixed(2)}</span>
                  </div>
              </div>
          </div>
      )}

      {/* Notes */}
      {data.notes && (
        <div className="mt-12 p-4 bg-gray-50 border-l-4 border-gray-300">
          <p className="text-[10px] font-bold uppercase text-gray-500 mb-1">Notas / Observaciones</p>
          <p className="text-sm italic">{data.notes}</p>
        </div>
      )}

      {/* Footer / Signatures */}
      <div className="mt-24 grid grid-cols-3 gap-12">
        <div className="border-t border-gray-400 pt-4 text-center">
          <p className="text-[10px] font-bold uppercase">Entregado por / Proveedor</p>
        </div>
        <div className="border-t border-gray-400 pt-4 text-center">
          <p className="text-[10px] font-bold uppercase">Revisado por</p>
        </div>
        <div className="border-t border-gray-400 pt-4 text-center">
          <p className="text-[10px] font-bold uppercase">Recibido por Almacén</p>
        </div>
      </div>

      <div className="mt-20 text-center text-[10px] text-gray-400 uppercase tracking-tighter">
        Este documento es un comprobante interno generado por el sistema VERUM el {new Date().toLocaleString()}
      </div>
      
      <style jsx global>{`
        @media print {
          body { margin: 0; padding: 0; }
          @page { size: auto; margin: 0mm; }
        }
      `}</style>
    </div>
  );
});

MovementPrint.displayName = 'MovementPrint';
