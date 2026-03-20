'use client'

import { useEffect, useState } from 'react'
import { attendanceApi } from '@/lib/api'
import { ArrowLeft, Loader2, Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export default function StaffHistoryPage() {
    const [history, setHistory] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const router = useRouter()

    useEffect(() => {
        attendanceApi.getHistory().then(setHistory).catch(console.error).finally(() => setLoading(false))
    }, [])

    return (
        <div className="min-h-screen bg-background pb-24">
            <header className="sticky top-0 z-10 bg-surface/80 backdrop-blur-md border-b border-border px-4 h-14 flex items-center gap-3">
                <button onClick={() => router.back()} className="p-2 -ml-2 text-text-secondary hover:text-text-primary">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="font-bold text-text-primary">Mi Historial</h1>
            </header>

            <main className="p-4 max-w-md mx-auto space-y-4 mt-4">
                {loading ? (
                    <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
                ) : history.length === 0 ? (
                    <div className="text-center p-8 text-text-secondary bg-surface rounded-2xl border border-border">
                        No hay registros recientes.
                    </div>
                ) : (
                    history.map((record, index) => (
                        <div key={index} className={`p-5 rounded-2xl border ${record.absence_type ? 'bg-error/5 border-error/20' : 'bg-surface border-border shadow-sm'}`}>
                            <div className="flex justify-between items-center mb-3">
                                <span className="font-bold text-text-primary">
                                    {format(parseISO(record.work_date), "EEEE, d 'de' MMMM", { locale: es })}
                                </span>
                                {record.absence_type && <span className="text-[10px] bg-error/10 text-error px-2 py-1 rounded-md font-bold uppercase">{record.absence_type}</span>}
                            </div>
                            {!record.absence_type && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-text-secondary">Entrada</span>
                                        <span className="font-medium text-text-primary">{record.clock_in ? format(new Date(record.clock_in), 'HH:mm') : '—'}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-text-secondary">Salida</span>
                                        <span className="font-medium text-text-primary">{record.clock_out ? format(new Date(record.clock_out), 'HH:mm') : '—'}</span>
                                    </div>
                                    <div className="pt-2 border-t border-border flex justify-between text-sm items-center">
                                        <span className="text-text-secondary">Horas Netas</span>
                                        <span className="font-black text-primary">{record.net_hours}h</span>
                                    </div>
                                    {(record.overtime_hours > 0 || record.minutes_late > 0) && (
                                        <div className="flex gap-2 pt-1">
                                            {record.overtime_hours > 0 && <span className="text-[10px] font-bold bg-success/10 text-success px-2 py-0.5 rounded-md">+{record.overtime_hours}h extra</span>}
                                            {record.minutes_late > 0 && <span className="text-[10px] font-bold bg-warning/10 text-warning px-2 py-0.5 rounded-md">{record.minutes_late} min tarde</span>}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </main>
        </div>
    )
}
