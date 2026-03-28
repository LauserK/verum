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
  gridConfig: { rows: number; cols: number };
}

export const BulkQRCodePrint = forwardRef<HTMLDivElement, BulkQRCodePrintProps>(
  ({ assets, venues, gridConfig }, ref) => {
    return (
      <div ref={ref} className="bg-white p-[10mm] text-black w-full">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page {
              size: letter;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
            }
          }
        `}} />
        <div 
          className="grid gap-4" 
          style={{ 
            gridTemplateColumns: `repeat(${gridConfig.cols}, 1fr)`,
            gridAutoRows: 'auto'
          }}
        >
          {assets.map((asset) => (
            <div key={asset.id} className="flex items-center justify-center border border-gray-100 overflow-hidden" style={{ breakInside: 'avoid' }}>
              <div style={{ transform: `scale(${1 / Math.max(gridConfig.cols, gridConfig.rows/1.5)})`, transformOrigin: 'center' }}>
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
