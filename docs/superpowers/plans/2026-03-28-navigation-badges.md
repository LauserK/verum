# Notification Badges in BottomNav Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir indicadores visuales (badges) en el `BottomNav` para avisar al usuario si tiene auditorías (checklists) o tareas de inventario pendientes.

**Architecture:** Se creará un hook personalizado `usePendingTasks` para centralizar la lógica de consulta a la API de Supabase. El `BottomNav` utilizará este hook para mostrar un círculo rojo sobre los iconos correspondientes si existen elementos pendientes.

**Tech Stack:** React (Next.js), Lucide React (Icons), Supabase Client.

---

### Task 1: Crear el hook usePendingTasks

**Files:**
- Create: `frontend/src/hooks/usePendingTasks.ts`

- [ ] **Step 1: Implementar el hook para consultar tareas pendientes**

```typescript
// frontend/src/hooks/usePendingTasks.ts
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { getProfile } from '@/lib/api'

export function usePendingTasks() {
    const [hasPendingChecklists, setHasPendingChecklists] = useState(false)
    const [hasPendingInventory, setHasPendingInventory] = useState(false)
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        async function checkPendingTasks() {
            try {
                const profile = await getProfile()
                if (!profile.venue_id) return

                // 1. Check pending checklists
                // A checklist is pending if status is 'pending' for the current venue
                // Note: The logic should match how getChecklists filters them
                const { data: checklists } = await supabase
                    .from('checklists')
                    .select('id, status')
                    .eq('venue_id', profile.venue_id)
                    .eq('status', 'pending')
                    .limit(1)

                setHasPendingChecklists(!!checklists && checklists.length > 0)

                // 2. Check pending inventory (count_schedules)
                // A schedule is due if next_due <= today
                const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD
                const { data: schedules } = await supabase
                    .from('count_schedules')
                    .select('id')
                    .eq('venue_id', profile.venue_id)
                    .lte('next_due', today)
                    .limit(1)

                setHasPendingInventory(!!schedules && schedules.length > 0)

            } catch (err) {
                console.error('Error checking pending tasks:', err)
            } finally {
                setLoading(false)
            }
        }

        checkPendingTasks()
        
        // Optional: Refresh every 5 minutes
        const interval = setInterval(checkPendingTasks, 5 * 60 * 1000)
        return () => clearInterval(interval)
    }, [supabase])

    return { hasPendingChecklists, hasPendingInventory, loading }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/usePendingTasks.ts
git commit -m "feat: add usePendingTasks hook for navigation badges"
```

---

### Task 2: Actualizar BottomNav con Badges

**Files:**
- Modify: `frontend/src/components/BottomNav.tsx`

- [ ] **Step 1: Integrar el hook y añadir el UI del badge**

```tsx
// frontend/src/components/BottomNav.tsx
'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ClipboardCheck, History, Box, Settings } from 'lucide-react'
import { useTranslations } from '@/components/I18nProvider'
import { usePendingTasks } from '@/hooks/usePendingTasks' // Nuevo import

export default function BottomNav() {
    const pathname = usePathname()
    const { t } = useTranslations('nav')
    const { hasPendingChecklists, hasPendingInventory } = usePendingTasks() // Usar hook

    const tabs = [
        { 
            label: t('audits'), 
            href: '/dashboard', 
            icon: ClipboardCheck,
            showBadge: hasPendingChecklists // Condición para auditorías
        },
        { 
            label: t('history'), 
            href: '/history', 
            icon: History 
        },
        { 
            label: t('inventory'), 
            href: '/inventory/utensils', 
            icon: Box,
            showBadge: hasPendingInventory // Condición para inventario
        },
        { 
            label: t('settings'), 
            href: '/settings', 
            icon: Settings 
        },
    ]

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-50">
            <div className="max-w-lg mx-auto flex justify-around items-center h-16 px-2">
                {tabs.map((tab) => {
                    const isActive = pathname === tab.href
                    const Icon = tab.icon
                    return (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            className={`
                                flex flex-col items-center justify-center gap-0.5 flex-1 h-full
                                transition-colors duration-200
                                ${isActive
                                    ? 'text-primary'
                                    : 'text-text-secondary hover:text-text-primary'
                                }
                            `}
                        >
                            <div className="relative">
                                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                                {/* Badge Indicator */}
                                {tab.showBadge && (
                                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-error border-2 border-surface"></span>
                                    </span>
                                )}
                            </div>
                            <span className={`text-[10px] font-medium ${isActive ? 'font-semibold' : ''}`}>
                                {tab.label}
                            </span>
                        </Link>
                    )
                })}
            </div>

            {/* Safe area for notch phones */}
            <div className="h-[env(safe-area-inset-bottom)]" />
        </nav>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/BottomNav.tsx
git commit -m "feat: add notification badges to BottomNav icons"
```

---

### Task 3: Verificación y Ajustes

- [ ] **Step 1: Verificar visualmente en el dashboard**
1. Asegurarse de que haya una auditoría pendiente en la base de datos para el usuario actual.
2. Verificar que aparezca el punto rojo en el icono de auditorías.
3. Completar la auditoría y verificar que el punto desaparezca (o esperar al refresco de 5 min).

- [ ] **Step 2: Verificar visualmente en inventario**
1. Asegurarse de que haya un `count_schedule` con `next_due` <= hoy.
2. Verificar que aparezca el punto rojo en el icono de caja (Inventario).

- [ ] **Step 3: Commit final**

```bash
git commit -m "docs: finalized notification badges implementation" --allow-empty
```
