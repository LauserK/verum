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
                {/* CSS Grid for stickers. 2 columns x 5 rows approx for Letter size stickers */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    {labels.map((weight, idx) => (
                        <div key={idx} className="border border-black rounded-lg p-3 flex flex-col justify-between h-[48mm] break-inside-avoid">
                            <div className="text-center border-b border-black pb-1.5">
                                <h1 className="text-lg font-black uppercase truncate leading-tight">{itemName}</h1>
                                <p className="text-xs font-black mt-0.5 tracking-wider">
                                    CONTENIDO: {weight} {uomName}
                                </p>
                            </div>
                            
                            <div className="flex justify-between items-center mt-2">
                                <div className="space-y-0.5 text-[9px] leading-tight">
                                    <div>
                                        <span className="font-bold uppercase opacity-70">Lote:</span>
                                        <span className="ml-1 font-mono font-black text-xs">{lotNumber}</span>
                                    </div>
                                    <div>
                                        <span className="font-bold uppercase opacity-70">Elaboración:</span>
                                        <span className="ml-1 font-bold">{format(prodDate, 'dd/MM/yyyy')}</span>
                                    </div>
                                    {expDate && (
                                        <div>
                                            <span className="font-bold uppercase opacity-70">Vencimiento:</span>
                                            <span className="ml-1 font-bold">{format(expDate, 'dd/MM/yyyy')}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="p-1 border border-black bg-white flex-shrink-0">
                                    <QRCodeSVG value={lotNumber} size={54} />
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
