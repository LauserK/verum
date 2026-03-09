'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ClipboardCheck, History, BarChart3, Settings } from 'lucide-react'

const tabs = [
    { label: 'Audits', href: '/dashboard', icon: ClipboardCheck },
    { label: 'History', href: '/history', icon: History },
    { label: 'Reports', href: '/reports', icon: BarChart3 },
    { label: 'Settings', href: '/settings', icon: Settings },
]

export default function BottomNav() {
    const pathname = usePathname()

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
                            <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
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
