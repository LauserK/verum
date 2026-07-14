'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getProfile, type Profile } from '@/lib/api'
import { logout } from '@/app/login/actions'
import { LayoutDashboard, ClipboardCheck, Users, Building2, Box, Clock, LogOut, ChevronLeft, Moon, Sun, ChefHat, ChevronDown, Menu, X, ShoppingCart } from 'lucide-react'
import { useTranslations } from '@/components/I18nProvider'
import { useTheme } from '@/components/ThemeProvider'
import { useVenue } from '@/components/VenueContext'
import { VenueSelector } from '@/components/VenueSelector'
import { ProfileProvider } from '@/components/ProfileContext'

interface SubnavItem {
    href: string;
    labelKey?: string;
    labelEs?: string;
    labelEn?: string;
}

interface NavItem {
    href: string;
    labelKey?: string;
    labelEs?: string;
    labelEn?: string;
    icon: React.ComponentType<any>;
    items?: SubnavItem[];
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { t, language } = useTranslations()
    const { theme, toggleTheme } = useTheme()
    const { isMultiOrg, activeOrgName } = useVenue()
    const router = useRouter()
    const pathname = usePathname()
    const [profile, setProfile] = useState<Profile | null>(null)
    const [loading, setLoading] = useState(true)

    // Interaction states
    const [isMobileOpen, setIsMobileOpen] = useState(false)
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
    const [expandedMobileItems, setExpandedMobileItems] = useState<Record<string, boolean>>({})

    const navRef = useRef<HTMLDivElement>(null)

    const NAV_ITEMS: NavItem[] = [
        {
            href: '/admin/dashboard',
            labelKey: 'nav.dashboard',
            labelEs: 'Dashboard',
            labelEn: 'Dashboard',
            icon: LayoutDashboard
        },
        {
            href: '/admin/checklists',
            labelKey: 'nav.checklists',
            labelEs: 'Checklists',
            labelEn: 'Checklists',
            icon: ClipboardCheck,
            items: [
                { href: '/admin/checklists/dashboard', labelKey: 'nav.dashboard', labelEs: 'Dashboard', labelEn: 'Dashboard' },
                { href: '/admin/templates', labelKey: 'nav.templates', labelEs: 'Plantillas', labelEn: 'Templates' },
                { href: '/admin/submissions', labelKey: 'nav.submissions', labelEs: 'Envíos', labelEn: 'Submissions' },
            ]
        },
        {
            href: '/admin/inventory',
            labelKey: 'nav.inventory',
            labelEs: 'Inventario',
            labelEn: 'Inventory',
            icon: Box,
            items: [
                { href: '/admin/inventory', labelEs: 'Dashboard', labelEn: 'Dashboard' },
                { href: '/admin/inventory/documents', labelEs: 'Documentos', labelEn: 'Documents' },
                { href: '/admin/inventory/assets', labelEs: 'Activos Fijos', labelEn: 'Fixed Assets' },
                { href: '/admin/inventory/tickets', labelEs: 'Tickets de Reparación', labelEn: 'Repair Tickets' },
                { href: '/admin/inventory/utensils', labelEs: 'Utensilios', labelEn: 'Utensils' },
                { href: '/admin/inventory/items', labelEs: 'Artículos', labelEn: 'Items' },
                { href: '/admin/inventory/warehouses', labelEs: 'Almacenes', labelEn: 'Warehouses' },
                { href: '/admin/inventory/kardex', labelEs: 'Kardex', labelEn: 'Kardex' },
                { href: '/admin/inventory/snapshot', labelEs: 'Historial de Inventario', labelEn: 'Inventory History' },
            ]
        },
        {
            href: '/admin/production',
            labelKey: 'nav.production',
            labelEs: 'Producción',
            labelEn: 'Production',
            icon: ChefHat,
            items: [
                { href: '/admin/production', labelEs: 'Dashboard', labelEn: 'Dashboard' },
                { href: '/production/kds?from=admin', labelEs: 'Tablero KDS', labelEn: 'KDS Board' },
                { href: '/admin/production/recipes', labelEs: 'Recetas', labelEn: 'Recipes' },
                { href: '/admin/production/orders', labelEs: 'Órdenes', labelEn: 'Orders' },
                { href: '/admin/production/catering', labelEs: 'Catering & MRP', labelEn: 'Catering & MRP' },
            ]
        },
        {
            href: '/admin/attendance',
            labelKey: 'nav.attendance',
            labelEs: 'Asistencia',
            labelEn: 'Attendance',
            icon: Clock,
            items: [
                { href: '/admin/attendance', labelEs: 'Dashboard', labelEn: 'Dashboard' },
                { href: '/admin/attendance/reports', labelEs: 'Reportes', labelEn: 'Reports' },
                { href: '/admin/attendance/shifts', labelEs: 'Turnos', labelEn: 'Shifts' },
                { href: '/admin/attendance/absences', labelEs: 'Ausencias', labelEn: 'Absences' },
            ]
        },
        {
            href: '/admin/suppliers',
            labelEs: 'Compras',
            labelEn: 'Purchasing',
            icon: ShoppingCart,
            items: [
                { href: '/admin/suppliers', labelEs: 'Proveedores', labelEn: 'Suppliers' },
                { href: '/admin/purchasing/orders', labelEs: 'Órdenes de Compra', labelEn: 'Purchase Orders' },
                { href: '/admin/settings/purchasing', labelEs: 'Configuración', labelEn: 'Settings' },
            ]
        },
        {
            href: '/admin/venues',
            labelKey: 'nav.company',
            labelEs: 'Empresa',
            labelEn: 'Company',
            icon: Building2
        },
        {
            href: '/admin/team',
            labelKey: 'nav.team',
            labelEs: 'Equipo',
            labelEn: 'Team',
            icon: Users
        }
    ]

    const getLocalizedLabel = (item: { labelKey?: string; labelEs?: string; labelEn?: string }) => {
        if (item.labelKey) {
            const val = t(item.labelKey)
            if (val !== item.labelKey) {
                return val
            }
        }
        return language === 'es' ? (item.labelEs || '') : (item.labelEn || '')
    }

    const isItemActive = (item: NavItem) => {
        if (pathname === item.href) return true
        if (item.href !== '/admin/dashboard' && pathname.startsWith(item.href + '/')) return true
        if (item.items) {
            return item.items.some((sub) => {
                if (pathname === sub.href) return true
                if (pathname.startsWith(sub.href + '/')) return true
                return false
            })
        }
        return false
    }

    const toggleMobileAccordion = (href: string) => {
        setExpandedMobileItems(prev => ({
            ...prev,
            [href]: !prev[href]
        }))
    }

    // Auto-expand the active section on mount / pathname change
    useEffect(() => {
        const activeItem = NAV_ITEMS.find(item => {
            if (!item.items) return false
            return item.items.some(sub => pathname === sub.href || pathname.startsWith(sub.href + '/')) || pathname === item.href || pathname.startsWith(item.href + '/')
        })
        if (activeItem) {
            setExpandedMobileItems(prev => ({
                ...prev,
                [activeItem.href]: true
            }))
        }
    }, [pathname])

    // Close desktop dropdowns on click outside and escape key
    useEffect(() => {
        function handleClickOutside(event: MouseEvent | TouchEvent) {
            if (navRef.current && !navRef.current.contains(event.target as Node)) {
                setActiveDropdown(null)
            }
        }
        
        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                setActiveDropdown(null)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('touchstart', handleClickOutside)
        document.addEventListener('keydown', handleKeyDown)

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('touchstart', handleClickOutside)
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [])

    useEffect(() => {
        async function checkAccess() {
            try {
                const p = await getProfile()
                if (p.role !== 'admin') {
                    router.push('/dashboard')
                    return
                }
                setProfile(p)
            } catch {
                router.push('/login')
            } finally {
                setLoading(false)
            }
        }
        checkAccess()
    }, [router])

    if (loading) {
        return (
            <div className="min-h-screen bg-bg flex items-center justify-center">
                <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-bg relative">
            {/* Mobile Navigation Drawer */}
            {isMobileOpen && (
                <>
                    {/* Backdrop */}
                    <div 
                        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ease-in-out animate-in fade-in"
                        onClick={() => setIsMobileOpen(false)}
                    />
                    
                    {/* Drawer Content */}
                    <div className="fixed left-0 top-0 bottom-0 w-72 z-50 bg-surface shadow-2xl flex flex-col transition-transform duration-300 ease-in-out transform translate-x-0 border-r border-border animate-in slide-in-from-left duration-300">
                        {/* Drawer Header */}
                        <div className="h-14 border-b border-border px-4 flex items-center justify-between">
                            <span className="text-base font-bold text-text-primary">VERUM Admin</span>
                            <button 
                                onClick={() => setIsMobileOpen(false)}
                                className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-raised rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Navigation Items */}
                        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                            {NAV_ITEMS.map((item) => {
                                const active = isItemActive(item)
                                const Icon = item.icon
                                const hasSubmenu = !!item.items
                                const isExpanded = !!expandedMobileItems[item.href]

                                return (
                                    <div key={item.href} className="space-y-1">
                                        {hasSubmenu ? (
                                            <>
                                                <button
                                                    onClick={() => toggleMobileAccordion(item.href)}
                                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                                                        ${active 
                                                            ? 'bg-primary/5 text-primary' 
                                                            : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <Icon className="w-4 h-4" />
                                                        <span>{getLocalizedLabel(item)}</span>
                                                    </div>
                                                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                                </button>

                                                {/* Accordion Panel with smooth height transition */}
                                                <div 
                                                    className={`grid transition-all duration-200 ease-in-out pl-6
                                                        ${isExpanded ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0 overflow-hidden'}`}
                                                >
                                                    <div className="overflow-hidden space-y-1">
                                                        {item.items?.map((sub) => {
                                                            const isSubActive = pathname === sub.href || pathname.startsWith(sub.href + '/')
                                                            return (
                                                                <button
                                                                    key={sub.href}
                                                                    onClick={() => {
                                                                        router.push(sub.href)
                                                                        setIsMobileOpen(false)
                                                                    }}
                                                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors block
                                                                        ${isSubActive 
                                                                            ? 'bg-primary/10 text-primary font-medium' 
                                                                            : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
                                                                        }`}
                                                                >
                                                                    {getLocalizedLabel(sub)}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    router.push(item.href)
                                                    setIsMobileOpen(false)
                                                }}
                                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                                                    ${active 
                                                        ? 'bg-primary/5 text-primary' 
                                                        : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
                                                    }`}
                                            >
                                                <Icon className="w-4 h-4" />
                                                <span>{getLocalizedLabel(item)}</span>
                                            </button>
                                        )}
                                    </div>
                                )
                            })}
                        </nav>
                    </div>
                </>
            )}

            {/* Top Bar */}
            <header className="sticky top-0 z-50 bg-surface border-b border-border px-4 h-14 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setIsMobileOpen(true)} 
                        className="text-text-secondary hover:text-text-primary transition-colors md:hidden p-1"
                        aria-label="Open Menu"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <button onClick={() => router.push('/dashboard')} className="text-text-secondary hover:text-text-primary transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-base font-bold text-text-primary hidden sm:block">VERUM Admin</h1>
                    <VenueSelector />
                </div>
                <div className="flex items-center gap-3">
                    {isMultiOrg && activeOrgName && (
                        <button 
                            onClick={() => router.push('/venue-selection')}
                            className="text-xs font-bold text-primary hover:text-primary-hover bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/10 transition-all flex items-center gap-2"
                        >
                            <Building2 className="w-3.5 h-3.5" />
                            {activeOrgName}
                        </button>
                    )}
                    <span className="text-xs text-text-secondary hidden md:block">{profile?.full_name}</span>
                    <button 
                        onClick={toggleTheme}
                        className="p-2 text-text-secondary hover:text-primary hover:bg-surface-raised rounded-xl transition-all"
                        aria-label="Toggle Theme"
                    >
                        {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                    </button>
                    <button onClick={() => logout()} className="text-text-secondary hover:text-error transition-colors">
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* Tab Navigation */}
            <nav ref={navRef} className="bg-surface border-b border-border px-4 hidden md:flex gap-1 overflow-x-auto md:overflow-visible relative">
                {NAV_ITEMS.map((item) => {
                    const active = isItemActive(item)
                    const Icon = item.icon
                    return (
                        <div key={item.href} className="relative flex items-center">
                            {item.items ? (
                                <>
                                    <button
                                        onClick={() => setActiveDropdown(activeDropdown === item.href ? null : item.href)}
                                        className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                                            ${active
                                                ? 'border-primary text-primary font-semibold'
                                                : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-strong'
                                            }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        <span>{getLocalizedLabel(item)}</span>
                                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdown === item.href ? 'rotate-180' : ''}`} />
                                    </button>
                                    
                                    {activeDropdown === item.href && (
                                        <div className="absolute top-full left-0 mt-1 w-56 bg-surface border border-border rounded-xl shadow-xl z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-200 ease-out">
                                            {item.items.map((sub) => {
                                                const isSubActive = pathname === sub.href || pathname.startsWith(sub.href + '/')
                                                return (
                                                    <button
                                                        key={sub.href}
                                                        onClick={() => {
                                                            router.push(sub.href)
                                                            setActiveDropdown(null)
                                                        }}
                                                        className={`w-full text-left px-4 py-2 text-sm transition-colors block
                                                            ${isSubActive 
                                                                ? 'bg-primary/5 text-primary font-medium' 
                                                                : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
                                                            }`}
                                                    >
                                                        {getLocalizedLabel(sub)}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <button
                                    onClick={() => {
                                        router.push(item.href)
                                        setActiveDropdown(null)
                                    }}
                                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                                        ${active
                                            ? 'border-primary text-primary font-semibold'
                                            : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-strong'
                                        }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {getLocalizedLabel(item)}
                                </button>
                            )}
                        </div>
                    )
                })}
            </nav>

            {/* Content */}
            <main className="max-w-5xl mx-auto px-4 py-6">
                <ProfileProvider value={profile}>
                    {children}
                </ProfileProvider>
            </main>
        </div>
    )
}
