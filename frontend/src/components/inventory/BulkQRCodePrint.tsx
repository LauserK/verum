import { forwardRef } from 'react';
import { QRCodePrint } from './QRCodePrint';

interface Asset {
  id: string;
  name: string;
  qr_code: string;
  venue_id: string;
}

interface Venue {
  id: string;
  name: string;
}

interface BulkQRCodePrintProps {
  assets: Asset[];
  venues: Venue[];
  gridConfig: { rows: number; cols: number; scale?: number };
}

export const BulkQRCodePrint = forwardRef<HTMLDivElement, BulkQRCodePrintProps>(
  ({ assets, venues, gridConfig }, ref) => {
    // Usamos la escala de la config o calculamos la base según columnas
    const scale = gridConfig.scale || (1 / gridConfig.cols);
    const itemWidth = 400 * scale;
    const itemHeight = 600 * scale;

    return (
      <div ref={ref} className="bg-white p-4 text-black w-full min-h-screen">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page {
              size: letter;
              margin: 10mm;
            }
            body {
              margin: 0;
              padding: 0;
            }
          }
        `}} />
        <div 
          className="grid gap-2" 
          style={{ 
            gridTemplateColumns: `repeat(${gridConfig.cols}, 1fr)`,
            justifyItems: 'center'
          }}
        >
          {assets.map((asset) => (
            <div 
              key={asset.id} 
              className="border border-gray-100 overflow-hidden bg-white" 
              style={{ 
                width: `${itemWidth}px`, 
                height: `${itemHeight}px`,
                breakInside: 'avoid'
              }}
            >
              <div style={{ 
                transform: `scale(${scale})`, 
                transformOrigin: 'top left',
                width: '400px',
                height: '600px'
              }}>
                <QRCodePrint 
                  asset={{
                    name: asset.name,
                    qr_code: asset.qr_code,
                    venueName: venues.find(v => v.id === asset.venue_id)?.name || 'Sede'
                  }} 
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
);

BulkQRCodePrint.displayName = 'BulkQRCodePrint';
