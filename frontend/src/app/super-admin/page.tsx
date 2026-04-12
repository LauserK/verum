'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SuperAdminPage() {
    const router = useRouter()
    
    useEffect(() => {
        router.replace('/super-admin/dashboard')
    }, [router])
    
    return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-xs text-text-secondary">Redirigiendo al panel...</p>
            <a href="/super-admin/dashboard" className="text-xs text-primary underline">Haga clic aquí si no es redirigido</a>
        </div>
    )
}
