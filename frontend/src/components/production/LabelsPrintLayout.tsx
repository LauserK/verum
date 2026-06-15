// frontend/src/components/production/LabelsPrintLayout.tsx
import React, { forwardRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { format, addDays } from 'date-fns'

interface LabelConfig {
    quantity: number
    weight: number
}

interface LabelsPrintLayoutProps {
    itemName: string
    lotNumber: string
    productionDate: string
    shelfLifeDays?: number | null
    uomName: string
    configs: LabelConfig[]
}

export const LabelsPrintLayout = forwardRef<HTMLDivElement, LabelsPrintLayoutProps>(({
    itemName, lotNumber, productionDate, shelfLifeDays, uomName, configs
}, ref) => {
    // Generate array of individual labels based on config
    const labels: number[] = []
    configs.forEach(conf => {
        for(let i = 0; i < conf.quantity; i++) {
            labels.push(conf.weight)
        }
    })

    const prodDate = new Date(productionDate)
    const expDate = shelfLifeDays ? addDays(prodDate, shelfLifeDays) : null

    return (
        <div className="hidden">
            <style>
                {`
                @media print {
                    @page {
                        size: letter;
                        margin: 10mm;
                    }
                }
                `}
            </style>
            <div ref={ref} className="print:block p-4 bg-white text-black w-full">
                {/* CSS Grid for stickers. 2 columns is a good starting point for Letter size stickers */}
                <div className="grid grid-cols-2 gap-4">
                    {labels.map((weight, idx) => (
                        <div key={idx} className="border border-black rounded-lg p-4 flex flex-col justify-between h-[65mm] break-inside-avoid">
                            <div className="text-center border-b border-black pb-2">
                                <h1 className="text-xl font-black uppercase truncate">{itemName}</h1>
                                <p className="text-sm font-bold mt-1">
                                    CONTENIDO: {weight} {uomName}
                                </p>
                            </div>
                            
                            <div className="flex justify-between items-end mt-2">
                                <div className="space-y-1 text-[10px]">
                                    <div>
                                        <span className="font-bold">LOTE:</span>
                                        <span className="ml-1 font-mono font-bold text-xs">{lotNumber}</span>
                                    </div>
                                    <div>
                                        <span className="font-bold">ELABORACIÓN:</span>
                                        <span className="ml-1">{format(prodDate, 'dd/MM/yyyy')}</span>
                                    </div>
                                    {expDate && (
                                        <div>
                                            <span className="font-bold">VENCIMIENTO:</span>
                                            <span className="ml-1">{format(expDate, 'dd/MM/yyyy')}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="p-1 border border-black bg-white">
                                    <QRCodeSVG value={lotNumber} size={60} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
})
LabelsPrintLayout.displayName = 'LabelsPrintLayout'
