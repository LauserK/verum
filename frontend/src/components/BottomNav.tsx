'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ClipboardCheck, History, Box, Settings } from 'lucide-react'
import { useTranslations } from '@/components/I18nProvider'
import { usePendingTasks } from '@/hooks/usePendingTasks'

export default function BottomNav() {
    const pathname = usePathname()
    const { t } = useTranslations('nav')
    const { hasPendingChecklists, hasPendingInventory } = usePendingTasks()

    const tabs = [
        { 
            label: t('audits'), 
            href: '/dashboard', 
            icon: ClipboardCheck,
            showBadge: hasPendingChecklists
        },
        { label: t('history'), href: '/history', icon: History },
        { 
            label: t('inventory'), 
            href: '/inventory/utensils', 
            icon: Box,
            showBadge: hasPendingInventory
        },
        { label: t('settings'), href: '/settings', icon: Settings },
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
