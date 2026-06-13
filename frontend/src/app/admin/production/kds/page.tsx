'use client'

import React, { useState, useEffect } from 'react'
import { adminApi, Warehouse, Profile } from '@/lib/api'
import { useVenue } from '@/components/VenueContext'
import { Loader2, ChefHat, Clock, MapPin, LayoutGrid } from 'lucide-react'

export default function KDSPage() {
    const { availableVenues } = useVenue()
    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [selectedVenueId, setSelectedVenueId] = useState('')
    const [productionWarehouse, setProductionWarehouse] = useState<Warehouse | null>(null)

    useEffect(() => {
        const storedProfile = localStorage.getItem('profile')
        if (storedProfile) {
            setProfile(JSON.parse(storedProfile))
        }
        
        // Try to pick first venue if none selected
        if (availableVenues.length > 0 && !selectedVenueId) {
            setSelectedVenueId(availableVenues[0].id)
        }
    }, [availableVenues])

    useEffect(() => {
        if (selectedVenueId) {
            loadKDSData()
        }
    }, [selectedVenueId])

    async function loadKDSData() {
        setLoading(true)
        try {
            const whs = await adminApi.getInventoryWarehouses()
            const prodWh = whs.find(w => w.venue_id === selectedVenueId && w.type === 'production')
            setProductionWarehouse(prodWh || null)

            if (prodWh) {
                const kdsOrders = await adminApi.getKDSOrders(prodWh.id)
                setOrders(kdsOrders)
            } else {
                setOrders([])
            }
        } catch (err) {
            console.error('Error loading KDS data:', err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-bg text-text-primary flex flex-col p-4 md:p-6">
            {/* KDS Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-border mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                        <ChefHat className="w-7 h-7 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">KDS Producción</h1>
                        <div className="flex items-center gap-4 mt-0.5">
                            <select 
                                value={selectedVenueId}
                                onChange={e => setSelectedVenueId(e.target.value)}
                                className="bg-transparent border-none text-sm text-text-secondary font-medium outline-none cursor-pointer hover:text-primary transition-colors p-0"
                            >
                                {availableVenues.map(v => (
                                    <option key={v.id} value={v.id}>{v.name}</option>
                                ))}
                            </select>
                            <span className="text-border">|</span>
                            <div className="flex items-center gap-1.5 text-xs text-text-secondary uppercase font-bold tracking-widest">
                                <Clock className="w-3.5 h-3.5" />
                                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="hidden sm:flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-[10px] text-text-secondary uppercase font-black tracking-tighter">Órdenes Activas</p>
                            <p className="text-xl font-bold text-primary">{orders.length}</p>
                        </div>
                        <div className="h-8 w-px bg-border"></div>
                    </div>

                    {profile && (
                        <div className="flex items-center gap-3 bg-surface-raised px-4 py-2 rounded-2xl border border-border shadow-sm">
                            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center font-bold text-text-inverse shadow-lg shadow-primary/20">
                                {profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
                            </div>
                            <div className="leading-tight">
                                <p className="font-bold text-sm">{profile.full_name}</p>
                                <p className="text-[10px] text-text-secondary uppercase font-bold">{profile.role}</p>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* KDS Grid Container */}
            <main className="flex-1 overflow-hidden flex flex-col">
                {loading ? (
                    <div className="flex-1 flex flex-center items-center justify-center">
                        <Loader2 className="w-10 h-10 animate-spin text-primary opacity-50" />
                    </div>
                ) : !productionWarehouse ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-surface border border-border border-dashed rounded-3xl">
                        <MapPin className="w-12 h-12 text-text-secondary mb-4 opacity-20" />
                        <h3 className="text-xl font-bold text-text-primary mb-2">Sin Almacén de Producción</h3>
                        <p className="text-text-secondary max-w-sm">
                            Esta sede no tiene configurado un almacén de tipo 'Producción'. 
                            Configúralo en la sección de Inventario para ver las comandas.
                        </p>
                    </div>
                ) : orders.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-surface border border-border border-dashed rounded-3xl">
                        <LayoutGrid className="w-12 h-12 text-text-secondary mb-4 opacity-20" />
                        <h3 className="text-xl font-bold text-text-primary mb-2">No hay órdenes pendientes</h3>
                        <p className="text-text-secondary max-w-sm">
                            Todo el trabajo de cocina está al día. Las nuevas órdenes aparecerán aquí automáticamente.
                        </p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 content-start pb-20">
                        {/* Task 5 will fill this */}
                    </div>
                )}
            </main>
        </div>
    )
}
