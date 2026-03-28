// frontend/src/components/inventory/QRCodePrint.tsx
import { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface QRCodePrintProps {
  asset: {
    name: string;
    qr_code: string;
    venueName?: string;
  };
}

export const QRCodePrint = forwardRef<HTMLDivElement, QRCodePrintProps>(({ asset }, ref) => {
  // Use absolute URL to the public asset page
  const qrUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/inventory/assets/${asset.qr_code}`
    : `https://app.verum.com/inventory/assets/${asset.qr_code}`;

  return (
    <div ref={ref} className="p-8 flex items-center justify-center bg-white text-black" style={{ width: '400px', height: '600px' }}>
      <div className="border-4 border-black rounded-3xl p-6 flex flex-col items-center w-full h-full text-center">
        {/* Header */}
        <h2 className="text-3xl font-black mb-1 uppercase tracking-tight">VERUM</h2>
        <p className="text-sm font-bold text-gray-500 mb-8 uppercase tracking-widest border-b-2 border-black pb-2 w-full">Control de Activos</p>
        
        {/* QR Code */}
        <div className="bg-white p-4 border-2 border-black rounded-xl mb-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <QRCodeSVG 
            value={qrUrl} 
            size={220} 
            level="H" 
            includeMargin={false}
          />
        </div>

        {/* Asset Details */}
        <div className="flex-1 w-full flex flex-col justify-end overflow-hidden">
          <h1 className="text-lg font-bold leading-tight mb-1 line-clamp-2 break-words">
            {asset.name}
          </h1>
          {asset.venueName && (
            <p className="text-sm font-medium text-gray-500 mb-2 truncate">{asset.venueName}</p>
          )}
          
          <div className="mt-auto pt-4 border-t-2 border-black w-full flex justify-between items-center text-xs font-mono font-bold text-gray-400">
            <span>ID: {asset.qr_code.substring(0, 8).toUpperCase()}</span>
            <span>ESCANEAME</span>
          </div>
        </div>
      </div>
    </div>
  );
});

QRCodePrint.displayName = 'QRCodePrint';
