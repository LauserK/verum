'use client'

import React, { useState, useEffect } from 'react'
import { useTranslations } from '@/components/I18nProvider'
import { Calendar, ChevronLeft, Plus, Loader2, Search, Filter, ArrowUpDown, X, MoreVertical, FileText, CheckCircle2, Clock, AlertCircle, Grid, LayoutList } from 'lucide-react'
import Link from 'next/link'
import { adminApi, CateringRequest } from '@/lib/api'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function CateringListPage() {
    const { t } = useTranslations('production')
    const [requests, setRequests] = useState<CateringRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [creating, setCreating] = useState(false)

    // New states for viewMode, statusTab, selectedMenuId
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
    const [statusTab, setStatusTab] = useState<'active' | 'completed' | 'cancelled' | 'all'>('active')
    const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null)

    // New Request Form
    const [newRequest, setNewRequest] = useState({
        name: '',
        event_date: '',
        notes: ''
    })

    useEffect(() => {
        loadRequests()
    }, [])

    // Click outside handler for context menu
    useEffect(() => {
        if (!selectedMenuId) return
        const closeMenu = () => setSelectedMenuId(null)
        window.addEventListener('click', closeMenu)
        return () => window.removeEventListener('click', closeMenu)
    }, [selectedMenuId])

    async function loadRequests() {
        setLoading(true)
        try {
            const data = await adminApi.getCateringRequests()
            setRequests(data)
        } catch (err) {
            console.error('Error loading catering requests:', err)
        } finally {
            setLoading(false)
        }
    }

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault()
        setCreating(true)
        try {
            await adminApi.createCateringRequest({
                ...newRequest,
                lines: [] // Start with empty lines
            })
            setShowCreateModal(false)
            setNewRequest({ name: '', event_date: '', notes: '' })
            loadRequests()
        } catch (err) {
            console.error('Error creating catering request:', err)
        } finally {
            setCreating(false)
        }
    }

    async function handleUpdateStatus(id: string, status: CateringRequest['status']) {
        try {
            await adminApi.updateCateringStatus(id, status)
            setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
            setSelectedMenuId(null)
        } catch (err) {
            console.error('Error updating catering status:', err)
        }
    }

    const getStatusDetails = (status: string) => {
        switch (status) {
            case 'planning':
                return {
                    label: 'Planificación',
                    badgeClass: 'bg-primary/10 text-primary',
                    dotClass: 'bg-primary animate-pulse'
                }
            case 'confirmed':
                return {
                    label: 'Confirmado',
                    badgeClass: 'bg-info/10 text-info',
                    dotClass: 'bg-info'
                }
            case 'completed':
                return {
                    label: 'Realizado',
                    badgeClass: 'bg-success/10 text-success',
                    dotClass: 'bg-success'
                }
            case 'cancelled':
                return {
                    label: 'Cancelado',
                    badgeClass: 'bg-error/10 text-error',
                    dotClass: 'bg-error'
                }
            default:
                return {
                    label: status,
                    badgeClass: 'bg-neutral/10 text-neutral',
                    dotClass: 'bg-neutral'
                }
        }
    }

    const filteredRequests = requests.filter(r => {
        const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase())
        if (!matchesSearch) return false

        if (statusTab === 'active') {
            return r.status === 'planning' || r.status === 'confirmed'
        } else if (statusTab === 'completed') {
            return r.status === 'completed'
        } else if (statusTab === 'cancelled') {
            return r.status === 'cancelled'
        }
        return true // 'all'
    })

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20 px-4">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-5">
                    <Link href="/admin/production" className="group p-3 bg-surface hover:bg-surface-raised border border-border rounded-2xl transition-all duration-300">
                        <ChevronLeft className="w-5 h-5 text-text-secondary group-hover:text-primary group-hover:-translate-x-0.5 transition-all" />
                    </Link>
                    <div>
                        <h1 className="text-4xl font-black text-text-primary tracking-tight">Catering & Eventos</h1>
                        <p className="text-text-secondary font-medium mt-1">Planificación y gestión de requerimientos especiales</p>
                    </div>
                </div>

                <button 
                    onClick={() => setShowCreateModal(true)}
                    className="w-full md:w-auto px-8 h-14 bg-primary text-text-inverse rounded-2xl font-black text-sm flex items-center justify-center gap-3 hover:bg-primary-hover shadow-xl shadow-primary/20 hover:shadow-primary/30 active:scale-[0.98] transition-all duration-300"
                >
                    <Plus className="w-5 h-5" /> Nuevo Evento
                </button>
            </div>

            {/* Stats / Quick Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-surface border border-border p-6 rounded-[32px] flex items-center gap-4 shadow-sm">
                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
                        <Calendar className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest">Eventos Activos</p>
                        <p className="text-2xl font-black text-text-primary">{requests.filter(r => r.status === 'planning' || r.status === 'confirmed').length}</p>
                    </div>
                </div>
            </div>

            {/* Pestañas de Estado */}
            <div className="flex border-b border-border overflow-x-auto whitespace-nowrap scrollbar-none gap-8 pt-4">
                {[
                    { id: 'active', label: 'Activos', filter: (r: CateringRequest) => r.status === 'planning' || r.status === 'confirmed' },
                    { id: 'completed', label: 'Realizados', filter: (r: CateringRequest) => r.status === 'completed' },
                    { id: 'cancelled', label: 'Cancelados', filter: (r: CateringRequest) => r.status === 'cancelled' },
                    { id: 'all', label: 'Todos', filter: () => true }
                ].map(tab => {
                    const count = requests.filter(tab.filter).length
                    const isActive = statusTab === tab.id
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setStatusTab(tab.id as any)}
                            className={`pb-4 text-xs font-black uppercase tracking-widest relative transition-all duration-300 flex items-center gap-2 ${
                                isActive ? 'text-primary' : 'text-text-secondary hover:text-text-primary'
                            }`}
                        >
                            {tab.label}
                            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black transition-all ${
                                isActive ? 'bg-primary/10 text-primary' : 'bg-surface-raised text-text-secondary'
                            }`}>
                                {count}
                            </span>
                            {isActive && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full animate-in fade-in duration-300" />
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Filters Bar */}
            <div className="bg-surface/50 backdrop-blur-md sticky top-4 z-20 rounded-[24px] border border-border p-3 flex flex-col md:flex-row gap-3 items-center shadow-lg">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                    <input 
                        type="text"
                        placeholder="Buscar por nombre del evento..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-bg border border-border rounded-xl pl-12 pr-4 h-12 text-sm font-bold outline-none focus:border-primary/50 transition-all placeholder:text-text-secondary/50 placeholder:font-medium"
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button 
                        onClick={() => setViewMode('grid')}
                        className={`p-3 border rounded-xl flex items-center justify-center transition-all ${
                            viewMode === 'grid' ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border hover:bg-surface-raised text-text-secondary'
                        }`}
                        title="Vista Cuadrícula"
                    >
                        <Grid className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={() => setViewMode('table')}
                        className={`p-3 border rounded-xl flex items-center justify-center transition-all ${
                            viewMode === 'table' ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border hover:bg-surface-raised text-text-secondary'
                        }`}
                        title="Vista Tabla"
                    >
                        <LayoutList className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Requests Grid/List */}
            {loading ? (
                <div className="py-20 text-center">
                    <Loader2 className="w-12 h-12 animate-spin mx-auto mb-6 text-primary opacity-40" />
                    <p className="text-sm font-black text-text-secondary uppercase tracking-[0.2em]">Cargando planificación...</p>
                </div>
            ) : filteredRequests.length === 0 ? (
                <div className="py-24 text-center bg-surface border border-border rounded-[48px] border-dashed">
                    <div className="w-24 h-24 bg-surface-raised rounded-full flex items-center justify-center mx-auto mb-6 text-text-secondary/20">
                        <FileText className="w-12 h-12" />
                    </div>
                    <h3 className="text-2xl font-black text-text-primary mb-2">Sin eventos planeados</h3>
                    <p className="text-text-secondary font-medium max-w-sm mx-auto">Comienza creando un nuevo requerimiento de catering para iniciar la planificación MRP.</p>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredRequests.map(request => {
                        const statusDetails = getStatusDetails(request.status)
                        return (
                            <div 
                                key={request.id} 
                                className="group bg-surface border border-border rounded-[40px] p-8 hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 relative overflow-hidden flex flex-col"
                            >
                                {/* Card Background Accent */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors duration-500" />
                                
                                <div className="flex justify-between items-start mb-6 relative z-10">
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${statusDetails.badgeClass}`}>
                                        <span className={`w-2 h-2 rounded-full ${statusDetails.dotClass}`} />
                                        {statusDetails.label}
                                    </span>
                                    
                                    <div className="relative">
                                        <button 
                                            onClick={(e) => {
                                                e.preventDefault()
                                                e.stopPropagation()
                                                setSelectedMenuId(selectedMenuId === request.id ? null : request.id)
                                            }}
                                            className="p-2 hover:bg-surface-raised rounded-xl transition-colors relative z-10"
                                        >
                                            <MoreVertical className="w-4 h-4 text-text-secondary" />
                                        </button>
                                        
                                        {selectedMenuId === request.id && (
                                            <div className="absolute right-0 mt-2 w-48 bg-surface border border-border rounded-2xl shadow-xl py-2 z-30 animate-in fade-in slide-in-from-top-1 duration-200">
                                                <Link 
                                                    href={`/admin/production/catering/${request.id}`}
                                                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-text-primary hover:bg-surface-raised transition-colors flex items-center gap-2"
                                                >
                                                    <FileText className="w-4 h-4 text-text-secondary" /> Ver Detalle
                                                </Link>
                                                
                                                {(request.status === 'confirmed' || request.status === 'completed' || request.status === 'cancelled') && (
                                                    <button 
                                                        onClick={(e) => {
                                                            e.preventDefault()
                                                            e.stopPropagation()
                                                            handleUpdateStatus(request.id, 'planning')
                                                        }}
                                                        className="w-full text-left px-4 py-2.5 text-xs font-bold text-text-primary hover:bg-surface-raised transition-colors flex items-center gap-2"
                                                    >
                                                        <Clock className="w-4 h-4 text-text-secondary" /> A Planificación
                                                    </button>
                                                )}
                                                
                                                {request.status !== 'completed' && request.status !== 'cancelled' && (
                                                    <button 
                                                        onClick={(e) => {
                                                            e.preventDefault()
                                                            e.stopPropagation()
                                                            handleUpdateStatus(request.id, 'completed')
                                                        }}
                                                        className="w-full text-left px-4 py-2.5 text-xs font-bold text-success hover:bg-success/10 transition-colors flex items-center gap-2"
                                                    >
                                                        <CheckCircle2 className="w-4 h-4 text-success" /> Marcar Realizado
                                                    </button>
                                                )}
                                                
                                                {request.status !== 'cancelled' && (
                                                    <button 
                                                        onClick={(e) => {
                                                            e.preventDefault()
                                                            e.stopPropagation()
                                                            handleUpdateStatus(request.id, 'cancelled')
                                                        }}
                                                        className="w-full text-left px-4 py-2.5 text-xs font-bold text-error hover:bg-error/10 transition-colors flex items-center gap-2"
                                                    >
                                                        <AlertCircle className="w-4 h-4 text-error" /> Cancelar Evento
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex-1 relative">
                                    <h3 className="text-2xl font-black text-text-primary group-hover:text-primary transition-colors leading-tight mb-2">
                                        <Link href={`/admin/production/catering/${request.id}`}>
                                            {request.name}
                                        </Link>
                                    </h3>
                                    {request.notes && <p className="text-sm text-text-secondary line-clamp-2 mb-4 font-medium italic">"{request.notes}"</p>}
                                </div>

                                <Link 
                                    href={`/admin/production/catering/${request.id}`}
                                    className="mt-6 pt-6 border-t border-border flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-text-secondary relative hover:text-primary transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-primary" />
                                        {request.event_date ? format(new Date(request.event_date), 'dd MMM yyyy', { locale: es }) : 'Sin fecha'}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        Ver Detalle
                                        <ChevronLeft className="w-3.5 h-3.5 rotate-180" />
                                    </div>
                                </Link>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="bg-surface border border-border rounded-[32px] overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-border bg-surface-raised/30">
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-text-secondary">Evento</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-text-secondary">Fecha</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-text-secondary">Notas</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-text-secondary">Estado</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-text-secondary text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                                {filteredRequests.map(request => {
                                    const statusDetails = getStatusDetails(request.status)
                                    return (
                                        <tr key={request.id} className="hover:bg-surface-raised/20 transition-colors group/row">
                                            <td className="px-6 py-5">
                                                <Link href={`/admin/production/catering/${request.id}`} className="font-bold text-text-primary hover:text-primary transition-colors block">
                                                    {request.name}
                                                </Link>
                                            </td>
                                            <td className="px-6 py-5 text-sm text-text-secondary font-medium whitespace-nowrap">
                                                {request.event_date ? format(new Date(request.event_date), 'dd MMM yyyy', { locale: es }) : 'Sin fecha'}
                                            </td>
                                            <td className="px-6 py-5 text-sm text-text-secondary font-medium max-w-xs truncate italic">
                                                {request.notes || '-'}
                                            </td>
                                            <td className="px-6 py-5 whitespace-nowrap">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${statusDetails.badgeClass}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${statusDetails.dotClass}`} />
                                                    {statusDetails.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-2">
                                                    {request.status !== 'completed' && request.status !== 'cancelled' && (
                                                        <button 
                                                            onClick={() => handleUpdateStatus(request.id, 'completed')}
                                                            className="h-8 px-3 rounded-lg bg-success/10 hover:bg-success text-success hover:text-white text-xs font-black uppercase tracking-widest transition-all duration-200 flex items-center gap-1"
                                                        >
                                                            <CheckCircle2 className="w-3.5 h-3.5" /> Realizado
                                                        </button>
                                                    )}
                                                    <div className="relative">
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setSelectedMenuId(selectedMenuId === request.id ? null : request.id)
                                                            }}
                                                            className="p-2 hover:bg-surface-raised rounded-xl transition-colors"
                                                        >
                                                            <MoreVertical className="w-4 h-4 text-text-secondary" />
                                                        </button>
                                                        
                                                        {selectedMenuId === request.id && (
                                                            <div className="absolute right-0 mt-2 w-48 bg-surface border border-border rounded-2xl shadow-xl py-2 z-30 animate-in fade-in slide-in-from-top-1 duration-200">
                                                                <Link 
                                                                    href={`/admin/production/catering/${request.id}`}
                                                                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-text-primary hover:bg-surface-raised transition-colors flex items-center gap-2"
                                                                >
                                                                    <FileText className="w-4 h-4 text-text-secondary" /> Ver Detalle
                                                                </Link>
                                                                
                                                                {(request.status === 'confirmed' || request.status === 'completed' || request.status === 'cancelled') && (
                                                                    <button 
                                                                        onClick={() => handleUpdateStatus(request.id, 'planning')}
                                                                        className="w-full text-left px-4 py-2.5 text-xs font-bold text-text-primary hover:bg-surface-raised transition-colors flex items-center gap-2"
                                                                    >
                                                                        <Clock className="w-4 h-4 text-text-secondary" /> A Planificación
                                                                    </button>
                                                                )}
                                                                
                                                                {request.status !== 'completed' && request.status !== 'cancelled' && (
                                                                    <button 
                                                                        onClick={() => handleUpdateStatus(request.id, 'completed')}
                                                                        className="w-full text-left px-4 py-2.5 text-xs font-bold text-success hover:bg-success/10 transition-colors flex items-center gap-2"
                                                                    >
                                                                        <CheckCircle2 className="w-4 h-4 text-success" /> Marcar Realizado
                                                                    </button>
                                                                )}
                                                                
                                                                {request.status !== 'cancelled' && (
                                                                    <button 
                                                                        onClick={() => handleUpdateStatus(request.id, 'cancelled')}
                                                                        className="w-full text-left px-4 py-2.5 text-xs font-bold text-error hover:bg-error/10 transition-colors flex items-center gap-2"
                                                                    >
                                                                        <AlertCircle className="w-4 h-4 text-error" /> Cancelar Evento
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-bg/80 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="bg-surface border border-border rounded-[48px] w-full max-w-xl p-10 shadow-2xl relative animate-in zoom-in-95 duration-300">
                        <button 
                            onClick={() => setShowCreateModal(false)}
                            className="absolute top-8 right-8 p-3 bg-surface hover:bg-surface-raised border border-border text-text-secondary hover:text-text-primary rounded-2xl transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="mb-8">
                            <h2 className="text-3xl font-black text-text-primary tracking-tight">Nuevo Evento</h2>
                            <p className="text-text-secondary font-medium mt-1">Define los detalles básicos para iniciar el MRP</p>
                        </div>

                        <form onSubmit={handleCreate} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest ml-4">Nombre del Evento</label>
                                <input 
                                    autoFocus
                                    required
                                    type="text"
                                    placeholder="Ej: Boda Familia García"
                                    value={newRequest.name}
                                    onChange={e => setNewRequest({...newRequest, name: e.target.value})}
                                    className="w-full bg-bg border border-border rounded-3xl px-6 h-16 text-sm font-bold outline-none focus:border-primary transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest ml-4">Fecha del Evento</label>
                                <input 
                                    type="date"
                                    value={newRequest.event_date}
                                    onChange={e => setNewRequest({...newRequest, event_date: e.target.value})}
                                    className="w-full bg-bg border border-border rounded-3xl px-6 h-16 text-sm font-bold outline-none focus:border-primary transition-all appearance-none"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest ml-4">Notas / Observaciones</label>
                                <textarea 
                                    placeholder="Detalles adicionales..."
                                    value={newRequest.notes}
                                    onChange={e => setNewRequest({...newRequest, notes: e.target.value})}
                                    className="w-full bg-bg border border-border rounded-3xl px-6 py-4 text-sm font-bold outline-none focus:border-primary transition-all min-h-[120px] resize-none"
                                />
                            </div>

                            <button 
                                disabled={creating}
                                type="submit"
                                className="w-full h-16 bg-primary text-text-inverse rounded-3xl font-black text-sm flex items-center justify-center gap-3 hover:bg-primary-hover shadow-xl shadow-primary/20 transition-all disabled:opacity-50"
                            >
                                {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                                Crear Solicitud
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
