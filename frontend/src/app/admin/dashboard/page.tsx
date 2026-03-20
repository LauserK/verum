'use client'

import { useEffect, useState } from 'react'
import { adminApi, getProfile, type Profile, type ComplianceReport } from '@/lib/api'
import {
    ClipboardCheck, Box, 
    AlertTriangle, ArrowRight, Loader2, Users,
    CheckCircle2, TrendingUp, Wrench, Building2
} from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface AdminSummary {
    active_staff: number;
    pending_tickets: number;
    critical_failures: number;
    today: string;
}

export default function GeneralAdminDashboard() {
    const [profile, setProfile] = useState<Profile | null>(null)
    const [summary, setSummary] = useState<AdminSummary | null>(null)
    const [compliance, setCompliance] = useState<ComplianceReport | null>(null)
    const [loading, setLoading] = useState(true)
    const [venueId, setVenueId] = useState<string>('')

    useEffect(() => {
        getProfile().then(p => {
            setProfile(p)
            if (p.venues.length > 0) setVenueId(p.venues[0].id)
        })
    }, [])

    useEffect(() => {
        if (!venueId) return
        
        // Use a flag to avoid setting state on unmounted component
        let mounted = true;
        
        const today = new Date().toISOString().split('T')[0]
        
        Promise.all([
            adminApi.getAdminSummary(venueId),
            adminApi.getCompliance({ venue_id: venueId, date_from: today, date_to: today })
        ]).then(([s, c]) => {
            if (mounted) {
                setSummary(s as AdminSummary)
                setCompliance(c)
            }
        }).catch(console.error).finally(() => {
            if (mounted) setLoading(false)
        })

        return () => { mounted = false; }
    }, [venueId])

    if (loading || !profile) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-text-primary tracking-tight">Panel de Control</h1>
                    <p className="text-text-secondary text-sm mt-1">Vista global de la operativa — {format(new Date(), 'EEEE, d MMMM', { locale: es })}</p>
                </div>
                <select
                    value={venueId}
                    onChange={(e) => setVenueId(e.target.value)}
                    className="bg-surface border border-border rounded-xl px-4 h-11 text-sm font-bold text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none shadow-sm transition-all"
                >
                    {profile.venues.map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                </select>
            </div>

            {/* Top Scorecards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Checklist Compliance Card */}
                <Link href="/admin/checklists/dashboard" className="bg-surface border border-border rounded-3xl p-6 shadow-sm hover:border-primary/50 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                            <ClipboardCheck className="w-6 h-6" />
                        </div>
                        <div className="text-right">
                            <span className={`text-2xl font-black ${(compliance?.compliance_pct ?? 0) >= 90 ? 'text-success' : 'text-warning'}`}>
                                {compliance?.compliance_pct ?? 0}%
                            </span>
                            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mt-1 text-nowrap">Cumplimiento Hoy</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between mt-6">
                        <p className="text-xs text-text-secondary font-medium">Ver detalles de checklists</p>
                        <ArrowRight className="w-4 h-4 text-text-secondary group-hover:translate-x-1 transition-transform" />
                    </div>
                </Link>

                {/* Staff Status Card */}
                <Link href="/admin/attendance" className="bg-surface border border-border rounded-3xl p-6 shadow-sm hover:border-primary/50 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-success/10 flex items-center justify-center text-success group-hover:scale-110 transition-transform">
                            <Users className="w-6 h-6" />
                        </div>
                        <div className="text-right">
                            <span className="text-2xl font-black text-text-primary">
                                {summary?.active_staff}
                            </span>
                            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mt-1 text-nowrap">Personal en Turno</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between mt-6">
                        <p className="text-xs text-text-secondary font-medium">Ver asistencia en vivo</p>
                        <ArrowRight className="w-4 h-4 text-text-secondary group-hover:translate-x-1 transition-transform" />
                    </div>
                </Link>

                {/* Pending Issues Card */}
                <Link href="/admin/inventory" className="bg-surface border border-border rounded-3xl p-6 shadow-sm hover:border-primary/50 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-error/10 flex items-center justify-center text-error group-hover:scale-110 transition-transform">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div className="text-right">
                            <span className="text-2xl font-black text-error">
                                {(summary?.pending_tickets || 0) + (summary?.critical_failures || 0)}
                            </span>
                            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mt-1 text-nowrap">Alertas Críticas</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between mt-6">
                        <p className="text-xs text-text-secondary font-medium">Ver tickets y averías</p>
                        <ArrowRight className="w-4 h-4 text-text-secondary group-hover:translate-x-1 transition-transform" />
                    </div>
                </Link>
            </div>

            {/* Middle Section: Insights & Live Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Checklist Alerts */}
                <div className="bg-surface border border-border rounded-3xl p-6 shadow-sm">
                    <h3 className="text-sm font-bold text-text-secondary uppercase tracking-widest mb-6 flex items-center gap-2">
                        <ClipboardCheck className="w-4 h-4" /> Alertas de Checklist
                    </h3>
                    <div className="space-y-4">
                        {summary?.critical_failures > 0 ? (
                            <div className="bg-error/5 border border-error/10 rounded-2xl p-4 flex items-start gap-4">
                                <AlertTriangle className="w-5 h-5 text-error mt-0.5" />
                                <div>
                                    <p className="text-sm font-bold text-text-primary">Fallas Críticas Detectadas</p>
                                    <p className="text-xs text-text-secondary mt-1">Hoy se han reportado {summary.critical_failures} puntos críticos fallidos en los checklists.</p>
                                    <Link href="/admin/checklists/dashboard" className="text-xs font-bold text-error hover:underline mt-3 inline-block">Revisar envíos →</Link>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-success/5 border border-success/10 rounded-2xl p-4 flex items-center gap-4">
                                <CheckCircle2 className="w-5 h-5 text-success" />
                                <p className="text-sm text-text-secondary">Sin fallas críticas reportadas hoy.</p>
                            </div>
                        )}

                        <div className="pt-4 border-t border-border">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-text-secondary uppercase">Progreso de ejecución</span>
                                <span className="text-xs font-black text-text-primary">{compliance?.completed_total} / {compliance?.total_expected}</span>
                            </div>
                            <div className="h-2 bg-surface-raised rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-primary transition-all duration-1000" 
                                    style={{ width: `${compliance?.compliance_pct || 0}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Maintenance & Inventory */}
                <div className="bg-surface border border-border rounded-3xl p-6 shadow-sm">
                    <h3 className="text-sm font-bold text-text-secondary uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Wrench className="w-4 h-4" /> Mantenimiento y Activos
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-surface-raised rounded-2xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center text-warning">
                                    <Wrench className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-text-primary">Tickets Abiertos</p>
                                    <p className="text-xs text-text-secondary">{summary?.pending_tickets} reparaciones en curso</p>
                                </div>
                            </div>
                            <Link href="/admin/inventory/tickets" className="p-2 text-text-secondary hover:text-primary transition-colors">
                                <ArrowRight className="w-5 h-5" />
                            </Link>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-surface-raised rounded-2xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                    <Box className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-text-primary">Inventario de Utensilios</p>
                                    <p className="text-xs text-text-secondary">Última auditoría hace 2 días</p>
                                </div>
                            </div>
                            <Link href="/admin/inventory/utensils" className="p-2 text-text-secondary hover:text-primary transition-colors">
                                <ArrowRight className="w-5 h-5" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions Footer */}
            <div className="bg-primary/5 border border-primary/10 rounded-3xl p-8 text-center">
                <h3 className="text-lg font-bold text-primary mb-2">Accesos Rápidos</h3>
                <div className="flex flex-wrap justify-center gap-4 mt-6">
                    <Link href="/admin/team" className="px-6 h-12 bg-primary text-text-inverse rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-primary-hover transition-all shadow-lg shadow-primary/20">
                        <Users className="w-4 h-4" /> Crear Usuario
                    </Link>
                    <Link href="/admin/venues" className="px-6 h-12 bg-surface border border-border text-text-primary rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-surface-raised transition-all">
                        <Building2 className="w-4 h-4" /> Configurar Sede
                    </Link>
                    <Link href="/admin/checklists/dashboard" className="px-6 h-12 bg-surface border border-border text-text-primary rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-surface-raised transition-all">
                        <TrendingUp className="w-4 h-4" /> Ver Reportes
                    </Link>
                </div>
            </div>
        </div>
    )
}
