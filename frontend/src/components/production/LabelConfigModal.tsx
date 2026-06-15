// frontend/src/components/production/LabelConfigModal.tsx
'use client'

import React, { useState, useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import { X, Plus, Trash2, Printer, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { LabelsPrintLayout } from './LabelsPrintLayout'
import { adminApi } from '@/lib/api'

interface LabelConfigModalProps {
    isOpen: boolean
    onClose: () => void
    producedLotId: string
    lotNumber: string
    itemName: string
    productionDate: string
    shelfLifeDays?: number | null
    uomName: string
    totalProduced: number
}

export function LabelConfigModal(props: LabelConfigModalProps) {
    const [configs, setConfigs] = useState([{ quantity: 1, weight: props.totalProduced }])
    const printRef = useRef<HTMLDivElement>(null)

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        onAfterPrint: async () => {
            try {
                await adminApi.markLotPrinted(props.producedLotId)
            } catch (e) {
                console.error("Error marking lot as printed", e)
            }
            props.onClose()
        }
    })

    if (!props.isOpen) return null

    const totalConfigured = configs.reduce((acc, c) => acc + (c.quantity * c.weight), 0)
    const difference = Math.abs(totalConfigured - props.totalProduced)
    const hasWarning = difference > 0.01

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-surface rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-border flex justify-between items-center bg-surface-raised/30">
                    <div>
                        <h2 className="text-xl font-black text-text-primary">Configurar Etiquetas</h2>
                        <p className="text-sm text-text-secondary mt-1">Lote: <span className="font-mono font-bold text-primary">{props.lotNumber}</span></p>
                    </div>
                    <button onClick={props.onClose} className="p-2 hover:bg-surface-raised rounded-xl transition-colors text-text-secondary"><X className="w-5 h-5"/></button>
                </div>
                
                <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                    <div className="flex justify-between items-center p-5 bg-primary/5 rounded-2xl border border-primary/20">
                        <div>
                            <p className="text-[10px] font-black text-primary uppercase tracking-widest">Rendimiento Real a Etiquetar</p>
                            <p className="text-3xl font-black text-text-primary mt-1">{props.totalProduced.toLocaleString()} <span className="text-lg text-text-secondary font-bold">{props.uomName}</span></p>
                        </div>
                        <CheckCircle2 className="w-8 h-8 text-primary opacity-50" />
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                            <label className="text-xs font-black text-text-secondary uppercase tracking-[0.2em]">Distribución de Envases</label>
                            <button 
                                onClick={() => setConfigs([...configs, { quantity: 1, weight: 0 }])} 
                                className="text-xs font-bold text-primary flex items-center gap-1.5 hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5"/> Agregar Fila
                            </button>
                        </div>
                        
                        <div className="space-y-3">
                            {configs.map((conf, idx) => (
                                <div key={idx} className="flex items-center gap-4 bg-surface-raised/50 p-3 rounded-2xl border border-border animate-in slide-in-from-left-2 duration-200">
                                    <div className="w-24">
                                        <label className="block text-[9px] uppercase font-black text-text-secondary mb-1 ml-1">Cant.</label>
                                        <input 
                                            type="number" 
                                            min="1" 
                                            value={conf.quantity} 
                                            onChange={e => {
                                                const newConf = [...configs]; 
                                                newConf[idx].quantity = parseInt(e.target.value) || 0; 
                                                setConfigs(newConf)
                                            }} 
                                            className="w-full h-11 px-3 bg-surface border border-border rounded-xl font-mono font-bold text-center focus:ring-2 focus:ring-primary/20 outline-none" 
                                        />
                                    </div>
                                    <span className="mt-5 text-text-secondary font-black text-xs">X</span>
                                    <div className="flex-1">
                                        <label className="block text-[9px] uppercase font-black text-text-secondary mb-1 ml-1">Peso por Envase ({props.uomName})</label>
                                        <input 
                                            type="number" 
                                            min="0" 
                                            step="0.01" 
                                            value={conf.weight} 
                                            onChange={e => {
                                                const newConf = [...configs]; 
                                                newConf[idx].weight = parseFloat(e.target.value) || 0; 
                                                setConfigs(newConf)
                                            }} 
                                            className="w-full h-11 px-4 bg-surface border border-border rounded-xl font-mono font-bold text-right focus:ring-2 focus:ring-primary/20 outline-none" 
                                        />
                                    </div>
                                    <div className="w-28 pt-5 text-right">
                                        <p className="text-[9px] uppercase font-black text-text-secondary mb-1 mr-1">Subtotal</p>
                                        <p className="font-mono font-black text-text-primary">{(conf.quantity * conf.weight).toLocaleString()}</p>
                                    </div>
                                    <div className="pt-5">
                                        <button 
                                            disabled={configs.length === 1}
                                            onClick={() => setConfigs(configs.filter((_, i) => i !== idx))} 
                                            className="p-2.5 text-error hover:bg-error/10 rounded-xl transition-colors disabled:opacity-0"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className={`p-4 rounded-2xl flex justify-between items-center border transition-all ${hasWarning ? 'bg-warning/10 border-warning/30 shadow-sm' : 'bg-success/5 border-success/20'}`}>
                        <div className="flex items-center gap-3">
                            {hasWarning ? <AlertTriangle className="w-5 h-5 text-warning" /> : <CheckCircle2 className="w-5 h-5 text-success" />}
                            <div>
                                <p className={`text-[10px] font-black uppercase ${hasWarning ? 'text-warning' : 'text-success'}`}>
                                    {hasWarning ? 'Diferencia Detectada' : 'Distribución Cuadrada'}
                                </p>
                                <p className="text-xs text-text-secondary">
                                    {hasWarning ? `Faltan/Sobran ${(props.totalProduced - totalConfigured).toFixed(2)} ${props.uomName}` : 'Todo el contenido está asignado'}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className={`font-mono text-xl font-black ${hasWarning ? 'text-warning' : 'text-success'}`}>
                                {totalConfigured.toLocaleString()}
                            </span>
                            <span className="ml-1 text-[10px] font-bold text-text-secondary uppercase">{props.uomName}</span>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-border flex gap-3 bg-surface-raised/30">
                    <button onClick={props.onClose} className="flex-1 py-4 font-bold text-text-secondary border border-border rounded-2xl hover:bg-surface transition-all">Cancelar</button>
                    <button 
                        onClick={() => handlePrint()} 
                        className="flex-[2] py-4 font-black bg-primary text-text-inverse rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        <Printer className="w-5 h-5"/> IMPRIMIR {configs.reduce((a,c) => a + c.quantity, 0)} ETIQUETAS
                    </button>
                </div>
            </div>

            <LabelsPrintLayout 
                ref={printRef}
                itemName={props.itemName}
                lotNumber={props.lotNumber}
                productionDate={props.productionDate}
                shelfLifeDays={props.shelfLifeDays}
                uomName={props.uomName}
                configs={configs}
            />
        </div>
    )
}
