'use client';

import React, { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface MovementPrintProps {
  type: 'receipt' | 'issue' | 'transfer';
  data: {
    id?: string;
    warehouseName: string; // Origin for transfers
    destinationName?: string; // Destination for transfers
    supplier?: string;
    receiptNumber?: string;
    reason?: string;
    notes?: string;
    createdAt: string;
    createdBy?: string;
    confirmedAt?: string;
    confirmedBy?: string;
    autoConfirm?: boolean;
    lines: Array<{
      itemName: string;
      qty: number;
      qtySent?: number;
      qtyReceived?: number;
      uom?: string;
      cost?: number;
      lot?: string;
    }>;
  };
}

export const MovementPrint = forwardRef<HTMLDivElement, MovementPrintProps>(({ type, data }, ref) => {
  const isReceipt = type === 'receipt';
  const isTransfer = type === 'transfer';
  const isIssue = type === 'issue';
  
  // Check if it's confirmed (for transfers or any doc with confirmedAt)
  const isConfirmed = !!data.confirmedAt;

  // Determine Title
  let title = 'Comprobante de Movimiento';
  if (isReceipt) title = 'Comprobante de Ingreso';
  if (isIssue) title = 'Comprobante de Egreso';
  if (isTransfer) title = 'Comprobante de Traslado';

  return (
    <div ref={ref} className="p-10 text-black bg-white min-h-screen font-sans relative flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-gray-900 pb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter uppercase mb-1">VERUM</h1>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none">Portal de Gestión Operativa</p>
        </div>
        <div className="text-right flex flex-col items-end">
          <h2 className="text-xl font-bold uppercase leading-none">{title}</h2>
          <p className="text-xs font-mono text-gray-600 mt-2">ID: {data.id?.slice(0, 8).toUpperCase() || '---'}</p>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-3 gap-8 my-8 text-sm">
        <div className="space-y-4">
          {isTransfer ? (
            <>
              <div>
                <p className="font-bold uppercase text-[9px] text-gray-400 mb-0.5">Almacén Origen</p>
                <p className="text-base font-bold">{data.warehouseName}</p>
              </div>
              <div>
                <p className="font-bold uppercase text-[9px] text-gray-400 mb-0.5">Almacén Destino</p>
                <p className="text-base font-bold text-primary">{data.destinationName}</p>
              </div>
            </>
          ) : (
            <div>
              <p className="font-bold uppercase text-[9px] text-gray-400 mb-0.5">Almacén</p>
              <p className="text-base font-bold">{data.warehouseName}</p>
            </div>
          )}

          {isReceipt && (
            <div>
              <p className="font-bold uppercase text-[9px] text-gray-400 mb-0.5">Proveedor</p>
              <p className="text-base font-bold">{data.supplier || 'N/A'}</p>
            </div>
          )}

          {isIssue && (
            <div>
              <p className="font-bold uppercase text-[9px] text-gray-400 mb-0.5">Motivo</p>
              <p className="text-base font-bold uppercase">{data.reason || 'Egreso General'}</p>
            </div>
          )}
          
          <div>
            <p className="font-bold uppercase text-[9px] text-gray-400 mb-0.5">Registrado por</p>
            <p className="text-sm font-semibold">{data.createdBy || 'Sistema'}</p>
          </div>
        </div>

        {/* QR Code Column (Centered) */}
        <div className="flex flex-col items-center justify-center">
            {isTransfer && data.id && (
                <div className="p-3 border-2 border-gray-900 rounded-2xl bg-white shadow-sm flex flex-col items-center">
                    <QRCodeSVG 
                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/admin/inventory/movements/transfers/${data.id}/confirm`}
                        size={100}
                        level="H"
                    />
                    <p className="text-[9px] font-black text-center mt-2 text-gray-900 tracking-tighter uppercase">Escanear para Recibir</p>
                </div>
            )}
        </div>

        <div className="space-y-4 text-right">
          <div>
            <p className="font-bold uppercase text-[9px] text-gray-400 mb-0.5">Fecha y Hora</p>
            <p className="text-base font-bold">{new Date(data.createdAt).toLocaleString()}</p>
          </div>
          {data.receiptNumber && (
            <div>
              <p className="font-bold uppercase text-[9px] text-gray-400 mb-0.5">Nº Documento</p>
              <p className="text-base font-bold">{data.receiptNumber}</p>
            </div>
          )}
          
          {isTransfer && !isConfirmed && (
            <div className="pt-2">
              <div className="inline-block border-2 border-gray-900 p-3 text-right w-full">
                <p className="font-bold uppercase text-[9px] text-gray-400 mb-1 text-left">Logística (Llenar a mano)</p>
                <div className="space-y-3">
                  <p className="text-[10px] border-b border-gray-200 pb-1">Encargado: ____________________</p>
                  <div className="flex justify-between gap-2">
                    <p className="text-[10px]">H. Salida: _______</p>
                    <p className="text-[10px]">H. Llegada: _______</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="mt-6 flex-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-900 bg-gray-50">
              <th className="py-3 px-2 text-[10px] font-bold uppercase tracking-widest">Descripción del Artículo</th>
              <th className="py-3 px-2 text-[10px] font-bold uppercase tracking-widest text-center">Unidad</th>
              <th className="py-3 px-2 text-[10px] font-bold uppercase tracking-widest text-center">Lote</th>
              
              {isTransfer && isConfirmed ? (
                <>
                  <th className="py-3 px-2 text-[10px] font-bold uppercase tracking-widest text-right">Enviado</th>
                  <th className="py-3 px-2 text-[10px] font-bold uppercase tracking-widest text-right">Recibido</th>
                  <th className="py-3 px-2 text-[10px] font-bold uppercase tracking-widest text-right text-error">Dif.</th>
                </>
              ) : (
                <th className="py-3 px-2 text-[10px] font-bold uppercase tracking-widest text-right">Cantidad</th>
              )}

              {isReceipt && <th className="py-3 px-2 text-[10px] font-bold uppercase tracking-widest text-right">Costo Unit.</th>}
              {isReceipt && <th className="py-3 px-2 text-[10px] font-bold uppercase tracking-widest text-right">Total</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.lines.map((line, index) => {
              const diff = (line.qtyReceived ?? 0) - (line.qtySent ?? line.qty);
              return (
                <tr key={index}>
                  <td className="py-3 px-2">
                      <p className="font-bold text-sm">{line.itemName}</p>
                  </td>
                  <td className="py-3 px-2 text-center">
                      <span className="text-[10px] font-bold uppercase text-gray-600">{line.uom || 'Base'}</span>
                  </td>
                  <td className="py-3 px-2 text-center font-mono text-xs">{line.lot || '---'}</td>
                  
                  {isTransfer && isConfirmed ? (
                    <>
                      <td className="py-3 px-2 text-right font-bold text-sm text-gray-500">{(line.qtySent ?? line.qty).toFixed(2)}</td>
                      <td className="py-3 px-2 text-right font-black text-sm text-gray-900">{(line.qtyReceived ?? 0).toFixed(2)}</td>
                      <td className={`py-3 px-2 text-right font-bold text-xs ${diff !== 0 ? 'text-error' : 'text-gray-300'}`}>
                        {diff !== 0 ? diff.toFixed(2) : '-'}
                      </td>
                    </>
                  ) : (
                    <td className="py-3 px-2 text-right font-black text-sm">{line.qty.toFixed(2)}</td>
                  )}

                  {isReceipt && <td className="py-3 px-2 text-right font-mono text-xs">${(line.cost || 0).toFixed(2)}</td>}
                  {isReceipt && <td className="py-3 px-2 text-right font-bold font-mono text-sm">${((line.qty) * (line.cost || 0)).toFixed(2)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Total Section for Receipts */}
      {isReceipt && (
          <div className="mt-6 flex justify-end">
              <div className="w-64 bg-gray-900 text-white p-4 rounded-lg">
                  <div className="flex justify-between items-center font-black text-lg">
                      <span className="text-[10px] uppercase">Total Valorizado</span>
                      <span>${data.lines.reduce((acc, l) => acc + (l.qty * (l.cost || 0)), 0).toFixed(2)}</span>
                  </div>
              </div>
          </div>
      )}

      {/* Notes */}
      {data.notes && (
        <div className="mt-8 p-4 bg-gray-50 border-l-4 border-gray-300">
          <p className="text-[9px] font-bold uppercase text-gray-400 mb-1">Notas / Observaciones</p>
          <p className="text-xs italic">{data.notes}</p>
        </div>
      )}

      {/* Signatures */}
      <div className="mt-auto pt-10">
        <div className="grid grid-cols-3 gap-12">
          <div className="text-center space-y-4">
            <div className="border-t border-gray-400 pt-2">
              <p className="text-[10px] font-bold uppercase mb-1">Entregado por</p>
              <div className="h-4" />
              <p className="text-[9px] text-gray-400">Firma y Hora: ___________</p>
            </div>
          </div>
          <div className="text-center space-y-4">
            <div className="border-t border-gray-400 pt-2">
              <p className="text-[10px] font-bold uppercase mb-1">Trasladado por</p>
              <div className="h-4" />
              <p className="text-[9px] text-gray-400">Firma y Hora: ___________</p>
            </div>
          </div>
          <div className="text-center space-y-4">
            <div className="border-t border-gray-400 pt-2">
              <p className="text-[10px] font-bold uppercase mb-1">Recibido por</p>
              <div className="h-4" />
              <p className="text-[9px] text-gray-400">Firma y Hora: ___________</p>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Banner */}
      {isConfirmed && (
          <div className="mt-10 bg-green-600 text-white p-4 -mx-10 -mb-10 flex justify-between items-center px-10">
              <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                      <p className="text-[10px] font-black uppercase tracking-widest leading-none">Documento Confirmado / Recibido</p>
                      <p className="text-[9px] opacity-80 font-bold mt-1">La mercancía ha sido verificada en el almacén de destino.</p>
                  </div>
              </div>
              <div className="text-right">
                  <p className="text-[10px] font-bold uppercase leading-none">{data.confirmedBy || 'Usuario'}</p>
                  <p className="text-[9px] opacity-80 mt-1">{data.confirmedAt ? new Date(data.confirmedAt).toLocaleString() : ''}</p>
              </div>
          </div>
      )}

      <div className={`mt-10 flex justify-between items-center text-[9px] text-gray-400 uppercase tracking-tight border-t border-gray-100 pt-4 ${isConfirmed ? 'hidden' : ''}`}>
        <span>VERUM LOGÍSTICA • {data.id || 'N/A'}</span>
        <span>Generado el {new Date().toLocaleString()}</span>
      </div>
      
      <style jsx global>{`
        @media print {
          body { margin: 0; padding: 0; }
          @page { size: auto; margin: 0mm; }
          .no-print { display: none; }
        }
      `}</style>
    </div>
  );
});

MovementPrint.displayName = 'MovementPrint';
