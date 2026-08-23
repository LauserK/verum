"use client"

import React, { useState, useEffect } from "react"
import { DownloadCloud, CheckCircle2, AlertCircle, RefreshCw, X, Layers, Sparkles } from "lucide-react"
import { fetchWithAuth } from "@/lib/api"

interface PreviewData {
    total_categories: number
    new_categories: number
    existing_categories: number
    total_modifier_groups: number
    new_modifier_groups: number
    existing_modifier_groups: number
    total_products: number
    new_products: number
    existing_products: number
    total_payment_methods?: number
    new_payment_methods?: number
    existing_payment_methods?: number
    categories_sample?: string[]
    modifier_groups_sample?: string[]
    products_sample?: string[]
    payment_methods_sample?: string[]
}

interface ImportResult {
    status: string
    categories_imported: number
    modifier_groups_imported: number
    modifier_options_imported: number
    products_created: number
    products_updated: number
    variants_imported: number
    product_modifier_links_created: number
    payment_methods_imported?: number
}

interface Props {
    isOpen: boolean
    onClose: () => void
    onSuccess?: () => void
}

export default function QuickCatalogImportModal({ isOpen, onClose, onSuccess }: Props) {
    const [step, setStep] = useState<"preview" | "options" | "executing" | "result">("preview")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [preview, setPreview] = useState<PreviewData | null>(null)

    // Options
    const [overwritePrices, setOverwritePrices] = useState(true)
    const [matchBy, setMatchBy] = useState("name_or_code")

    // Result
    const [importResult, setImportResult] = useState<ImportResult | null>(null)

    useEffect(() => {
        if (!isOpen) {
            setStep("preview")
            setPreview(null)
            setError(null)
            setImportResult(null)
            return
        }

        const loadPreview = async () => {
            setLoading(true)
            setError(null)
            try {
                const res = await fetchWithAuth<PreviewData>("/api/integrations/quick/preview-catalog")
                setPreview(res)
            } catch (err: any) {
                setError(err?.message || "No se pudo conectar con VerumQuick para obtener la vista previa del catálogo.")
            } finally {
                setLoading(false)
            }
        }

        loadPreview()
    }, [isOpen])

    const handleExecuteImport = async () => {
        setStep("executing")
        setLoading(true)
        setError(null)
        try {
            const res = await fetchWithAuth<ImportResult>("/api/integrations/quick/import-catalog", {
                method: "POST",
                body: JSON.stringify({
                    overwrite_existing_prices: overwritePrices,
                    match_by: matchBy
                })
            })
            setImportResult(res)
            setStep("result")
            if (onSuccess) onSuccess()
        } catch (err: any) {
            setError(err?.message || "Ocurrió un error al procesar la importación del catálogo.")
            setStep("options")
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface border border-border rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-border flex items-center justify-between bg-surface-raised/40">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <DownloadCloud className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-text-primary">
                                Importar Catálogo desde VerumQuick
                            </h2>
                            <p className="text-xs text-text-secondary">
                                Migra categorías, modificadores y productos existentes a VERUM
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-text-secondary hover:text-text-primary rounded-full hover:bg-surface-raised transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-6">
                    {error && (
                        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {loading && step === "preview" && (
                        <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
                            <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                            <p className="text-sm font-medium text-text-secondary">
                                Analizando catálogo en VerumQuick y detectando coincidencias...
                            </p>
                        </div>
                    )}

                    {!loading && step === "preview" && preview && (
                        <div className="space-y-5">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="p-3.5 bg-surface-raised border border-border rounded-2xl text-center">
                                    <span className="text-xl font-black text-text-primary">{preview.total_categories}</span>
                                    <p className="text-xs font-semibold text-text-secondary mt-0.5">Categorías</p>
                                    <span className="text-[10px] text-emerald-400 font-medium">+{preview.new_categories} nuevas</span>
                                </div>
                                <div className="p-3.5 bg-surface-raised border border-border rounded-2xl text-center">
                                    <span className="text-xl font-black text-text-primary">{preview.total_modifier_groups}</span>
                                    <p className="text-xs font-semibold text-text-secondary mt-0.5">Modificadores</p>
                                    <span className="text-[10px] text-emerald-400 font-medium">+{preview.new_modifier_groups} nuevos</span>
                                </div>
                                <div className="p-3.5 bg-surface-raised border border-border rounded-2xl text-center">
                                    <span className="text-xl font-black text-text-primary">{preview.total_products}</span>
                                    <p className="text-xs font-semibold text-text-secondary mt-0.5">Productos</p>
                                    <span className="text-[10px] text-emerald-400 font-medium">+{preview.new_products} nuevos</span>
                                </div>
                                <div className="p-3.5 bg-surface-raised border border-border rounded-2xl text-center">
                                    <span className="text-xl font-black text-text-primary">{preview.total_payment_methods ?? 0}</span>
                                    <p className="text-xs font-semibold text-text-secondary mt-0.5">Métodos Pago</p>
                                    <span className="text-[10px] text-emerald-400 font-medium">+{(preview as any).new_payment_methods ?? 0} nuevos</span>
                                </div>
                            </div>

                            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-300 space-y-1">
                                <p className="font-bold flex items-center gap-1.5">
                                    <Sparkles className="w-4 h-4" /> Protección de Modificadores en POS:
                                </p>
                                <p className="text-amber-200/90 leading-relaxed">
                                    Al importar los modificadores, VERUM vinculará los grupos correspondientes a cada producto para que al editarlos en el futuro no se desvinculen en VerumQuick.
                                </p>
                            </div>
                        </div>
                    )}

                    {step === "options" && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-text-primary">Opciones de Importación</h3>
                            
                            <label className="flex items-start gap-3 p-4 bg-surface-raised border border-border rounded-2xl cursor-pointer hover:border-primary/40 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={overwritePrices}
                                    onChange={(e) => setOverwritePrices(e.target.checked)}
                                    className="mt-1 w-4 h-4 rounded text-primary accent-primary cursor-pointer"
                                />
                                <div>
                                    <p className="text-sm font-semibold text-text-primary">Actualizar Precios de Venta</p>
                                    <p className="text-xs text-text-secondary mt-0.5">
                                        Si un producto ya existe en VERUM, actualizar su precio de venta con el precio vigente en VerumQuick.
                                    </p>
                                </div>
                            </label>

                            <label className="flex items-start gap-3 p-4 bg-surface-raised border border-border rounded-2xl cursor-pointer hover:border-primary/40 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={true}
                                    disabled
                                    className="mt-1 w-4 h-4 rounded text-primary accent-primary opacity-60"
                                />
                                <div>
                                    <p className="text-sm font-semibold text-text-primary">Vincular por Nombre / Código (Fusión Segura)</p>
                                    <p className="text-xs text-text-secondary mt-0.5">
                                        Evita duplicar productos y categorías existentes asociándoles los modificadores importados.
                                    </p>
                                </div>
                            </label>
                        </div>
                    )}

                    {step === "executing" && (
                        <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
                            <div className="relative">
                                <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
                                <Layers className="w-6 h-6 text-primary absolute inset-0 m-auto" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-text-primary">Importando Catálogo...</h3>
                                <p className="text-xs text-text-secondary mt-1">
                                    Creando categorías, modificadores, opciones, productos, variantes y métodos de pago.
                                </p>
                            </div>
                        </div>
                    )}

                    {step === "result" && importResult && (
                        <div className="space-y-5 text-center py-4">
                            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-text-primary">¡Catálogo Importado con Éxito!</h3>
                                <p className="text-xs text-text-secondary mt-1">
                                    Toda la información ha sido migrada y vinculada correctamente.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-left">
                                <div className="p-3 bg-surface-raised border border-border rounded-xl">
                                    <span className="text-xs text-text-secondary">Categorías Creadas</span>
                                    <p className="text-base font-bold text-text-primary">{importResult.categories_imported}</p>
                                </div>
                                <div className="p-3 bg-surface-raised border border-border rounded-xl">
                                    <span className="text-xs text-text-secondary">Grupos Modificadores</span>
                                    <p className="text-base font-bold text-text-primary">{importResult.modifier_groups_imported}</p>
                                </div>
                                <div className="p-3 bg-surface-raised border border-border rounded-xl">
                                    <span className="text-xs text-text-secondary">Opciones Modificador</span>
                                    <p className="text-base font-bold text-text-primary">{importResult.modifier_options_imported}</p>
                                </div>
                                <div className="p-3 bg-surface-raised border border-border rounded-xl">
                                    <span className="text-xs text-text-secondary">Productos Creados / Act.</span>
                                    <p className="text-base font-bold text-text-primary">
                                        {importResult.products_created} / {importResult.products_updated}
                                    </p>
                                </div>
                                <div className="p-3 bg-surface-raised border border-border rounded-xl">
                                    <span className="text-xs text-text-secondary">Variantes Creadas</span>
                                    <p className="text-base font-bold text-text-primary">{importResult.variants_imported}</p>
                                </div>
                                <div className="p-3 bg-surface-raised border border-border rounded-xl">
                                    <span className="text-xs text-text-secondary">Métodos de Pago</span>
                                    <p className="text-base font-bold text-text-primary">{(importResult as any).payment_methods_imported ?? 0}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="p-6 border-t border-border flex items-center justify-between bg-surface-raised/40">
                    {step === "preview" && (
                        <>
                            <button
                                onClick={onClose}
                                className="px-4 py-2.5 text-xs font-semibold text-text-secondary hover:text-text-primary rounded-xl hover:bg-surface-raised transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => setStep("options")}
                                disabled={!preview || preview.total_products === 0}
                                className="px-5 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                            >
                                Continuar
                            </button>
                        </>
                    )}

                    {step === "options" && (
                        <>
                            <button
                                onClick={() => setStep("preview")}
                                className="px-4 py-2.5 text-xs font-semibold text-text-secondary hover:text-text-primary rounded-xl hover:bg-surface-raised transition-colors"
                            >
                                Atrás
                            </button>
                            <button
                                onClick={handleExecuteImport}
                                disabled={loading}
                                className="px-6 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2"
                            >
                                <DownloadCloud className="w-4 h-4" />
                                Iniciar Importación
                            </button>
                        </>
                    )}

                    {step === "result" && (
                        <button
                            onClick={onClose}
                            className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                        >
                            Listo
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
