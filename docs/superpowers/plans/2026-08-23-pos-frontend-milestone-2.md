# POS Frontend Milestone 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the base Point of Sale (POS) frontend interface, including a full-screen layout, session selector, dynamic product catalog, and a state-managed shopping cart (Minuta).

**Architecture:** This milestone sets up the frontend POS module under `/pos`. It introduces `zustand` for local state management (the draft cart/minuta). The UI follows a 70/30 split layout (Catalog on the left, Cart on the right). It leverages existing backend API hooks from `useSales`. 

**Tech Stack:** Next.js (App Router), React, Tailwind CSS, Zustand, TypeScript.

---

### Task 1: Setup Zustand Store for POS Cart

**Files:**
- Create: `frontend/src/store/posStore.ts`
- Create: `frontend/src/store/posStore.test.ts` (For simple logic verification)
- Modify: `frontend/package.json`

- [ ] **Step 1: Install Zustand**

```bash
cd frontend && npm install zustand
```

- [ ] **Step 2: Write the failing test logic (Type validation)**

Since we are in Next.js without Jest, we will use TypeScript compiler to verify the store's type definitions and logic structure.

```typescript
// frontend/src/store/posStore.test.ts
// This is a type-check test file.
import { usePosStore } from './posStore'
import { SaleItem } from '@/lib/api/sales'

function testStore() {
    const state = usePosStore.getState()
    
    // Add item
    const mockItem: SaleItem = { id: '1', name: 'Burger', price: 10, is_active: true } as SaleItem
    state.addItem(mockItem)
    
    // Check totals
    if (state.cart.length !== 1) throw new Error("Item not added")
    if (state.total !== 10) throw new Error("Total incorrect")
    
    // Update quantity
    state.updateQuantity('1', 2)
    if (state.total !== 20) throw new Error("Quantity update failed")
    
    // Clear
    state.clearCart()
    if (state.cart.length !== 0) throw new Error("Clear failed")
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npx tsc src/store/posStore.test.ts --noEmit --skipLibCheck`
Expected: FAIL with "Cannot find module './posStore'".

- [ ] **Step 4: Write minimal implementation**

```typescript
// frontend/src/store/posStore.ts
import { create } from 'zustand'
import { SaleItem } from '@/lib/api/sales'

export interface CartItem extends SaleItem {
    cartItemId: string; // Unique ID for cart instance
    quantity: number;
    notes?: string;
}

interface PosState {
    cart: CartItem[];
    total: number;
    posMode: 'dine_in' | 'takeout' | 'delivery' | 'bar';
    setPosMode: (mode: 'dine_in' | 'takeout' | 'delivery' | 'bar') => void;
    addItem: (item: SaleItem) => void;
    removeItem: (cartItemId: string) => void;
    updateQuantity: (cartItemId: string, qty: number) => void;
    clearCart: () => void;
}

export const usePosStore = create<PosState>((set) => ({
    cart: [],
    total: 0,
    posMode: 'takeout',
    setPosMode: (mode) => set({ posMode: mode }),
    addItem: (item) => set((state) => {
        // Find if already exists
        const existing = state.cart.find(c => c.id === item.id)
        if (existing) {
            const updated = state.cart.map(c => 
                c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
            )
            return { cart: updated, total: state.total + Number(item.price) }
        }
        const newItem: CartItem = { ...item, cartItemId: crypto.randomUUID(), quantity: 1 }
        return { cart: [...state.cart, newItem], total: state.total + Number(item.price) }
    }),
    removeItem: (cartItemId) => set((state) => {
        const item = state.cart.find(c => c.cartItemId === cartItemId)
        if (!item) return state
        const deduction = Number(item.price) * item.quantity
        return {
            cart: state.cart.filter(c => c.cartItemId !== cartItemId),
            total: state.total - deduction
        }
    }),
    updateQuantity: (cartItemId, qty) => set((state) => {
        let diff = 0
        const updated = state.cart.map(c => {
            if (c.cartItemId === cartItemId) {
                diff = (qty - c.quantity) * Number(c.price)
                return { ...c, quantity: qty }
            }
            return c
        })
        return { cart: updated, total: state.total + diff }
    }),
    clearCart: () => set({ cart: [], total: 0 }),
}))
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx tsc src/store/posStore.test.ts --noEmit --skipLibCheck`
Expected: PASS (No output).

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/store/posStore.ts frontend/src/store/posStore.test.ts
git commit -m "feat(pos): add zustand store for POS cart management"
```

### Task 2: POS Fullscreen Layout & Session Selector

**Files:**
- Create: `frontend/src/app/pos/layout.tsx`
- Create: `frontend/src/app/pos/session/page.tsx`

- [ ] **Step 1: Write Layout and Page Implementation**

```tsx
// frontend/src/app/pos/layout.tsx
import React from 'react'

export default function PosLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="h-screen w-screen overflow-hidden bg-bg text-text-primary flex flex-col">
            {children}
        </div>
    )
}
```

```tsx
// frontend/src/app/pos/session/page.tsx
'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { usePosStore } from '@/store/posStore'
import { Utensils, ShoppingBag, Store } from 'lucide-react'

export default function PosSessionPage() {
    const router = useRouter()
    const setPosMode = usePosStore(s => s.setPosMode)

    const handleSelectMode = (mode: 'dine_in' | 'takeout') => {
        setPosMode(mode)
        router.push('/pos/terminal')
    }

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-surface-raised">
            <h1 className="text-3xl font-bold mb-8 text-text-primary flex items-center gap-3">
                <Store className="w-8 h-8 text-primary" /> Apertura de Caja POS
            </h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl w-full">
                <button onClick={() => handleSelectMode('dine_in')} className="p-8 bg-surface border border-border rounded-2xl shadow-sm hover:border-primary hover:shadow-md transition-all flex flex-col items-center gap-4 group">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <Utensils className="w-8 h-8 text-primary" />
                    </div>
                    <span className="text-xl font-bold">Servicio de Mesas</span>
                </button>
                <button onClick={() => handleSelectMode('takeout')} className="p-8 bg-surface border border-border rounded-2xl shadow-sm hover:border-primary hover:shadow-md transition-all flex flex-col items-center gap-4 group">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <ShoppingBag className="w-8 h-8 text-primary" />
                    </div>
                    <span className="text-xl font-bold">Para Llevar / Mostrador</span>
                </button>
            </div>
        </div>
    )
}
```

- [ ] **Step 2: Verify Types**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/pos/layout.tsx frontend/src/app/pos/session/page.tsx
git commit -m "feat(pos): add pos layout and session initialization page"
```

### Task 3: POS Terminal Layout & Catalog

**Files:**
- Create: `frontend/src/app/pos/terminal/page.tsx`
- Create: `frontend/src/app/pos/terminal/components/PosCatalog.tsx`

- [ ] **Step 1: Implement POS Catalog Component**

```tsx
// frontend/src/app/pos/terminal/components/PosCatalog.tsx
'use client'

import React, { useState } from 'react'
import { useSalesItems, useCategories } from '@/hooks/useSales'
import { usePosStore } from '@/store/posStore'

export default function PosCatalog() {
    const { data: items = [] } = useSalesItems()
    const { data: categories = [] } = useCategories()
    const [selectedCat, setSelectedCat] = useState<string>('all')
    const addItem = usePosStore(s => s.addItem)

    const activeItems = items.filter(i => i.is_active)
    const filteredItems = selectedCat === 'all' ? activeItems : activeItems.filter(i => i.category_id === selectedCat)

    return (
        <div className="flex flex-col h-full">
            {/* Category Filter */}
            <div className="flex gap-2 p-4 overflow-x-auto border-b border-border bg-surface shrink-0 no-scrollbar">
                <button 
                    onClick={() => setSelectedCat('all')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${selectedCat === 'all' ? 'bg-primary text-text-inverse' : 'bg-surface-raised text-text-secondary hover:text-text-primary border border-border'}`}
                >
                    Todos
                </button>
                {categories.map(c => (
                    <button 
                        key={c.id}
                        onClick={() => setSelectedCat(c.id)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${selectedCat === c.id ? 'bg-primary text-text-inverse' : 'bg-surface-raised text-text-secondary hover:text-text-primary border border-border'}`}
                    >
                        {c.name}
                    </button>
                ))}
            </div>

            {/* Product Grid */}
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 content-start">
                {filteredItems.map(item => (
                    <button 
                        key={item.id} 
                        onClick={() => addItem(item)}
                        className="flex flex-col items-center justify-center p-4 bg-surface border border-border rounded-2xl shadow-sm hover:border-primary active:scale-95 transition-all aspect-square text-center gap-3"
                    >
                        <span className="font-bold text-sm leading-tight text-text-primary line-clamp-3">{item.name}</span>
                        <span className="text-sm font-black text-primary">${Number(item.price).toFixed(2)}</span>
                    </button>
                ))}
            </div>
        </div>
    )
}
```

- [ ] **Step 2: Implement Terminal Page Shell**

```tsx
// frontend/src/app/pos/terminal/page.tsx
'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, UserCircle } from 'lucide-react'
import PosCatalog from './components/PosCatalog'

export default function PosTerminalPage() {
    const router = useRouter()

    return (
        <div className="flex-1 flex flex-col h-full bg-bg">
            {/* Global Header */}
            <header className="h-16 bg-surface border-b border-border flex items-center px-4 justify-between shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.push('/pos/session')} className="p-2 -ml-2 rounded-xl text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <span className="font-bold text-lg text-text-primary">Caja Principal</span>
                </div>
                <div className="flex items-center gap-2 text-sm font-bold text-text-secondary px-3 py-1.5 bg-surface-raised rounded-full border border-border">
                    <UserCircle className="w-4 h-4" />
                    Cajero Activo
                </div>
            </header>

            {/* Split Layout */}
            <div className="flex-1 flex overflow-hidden">
                {/* 70% Left: Catalog / Floor Plans */}
                <div className="flex-1 bg-surface-raised overflow-hidden">
                    <PosCatalog />
                </div>

                {/* 30% Right: Minuta / Cart (Placeholder for next task) */}
                <div className="w-[350px] lg:w-[400px] bg-surface border-l border-border flex flex-col shrink-0">
                    <div className="p-4 border-b border-border font-bold text-text-primary text-center">
                        Minuta (Carrito)
                    </div>
                </div>
            </div>
        </div>
    )
}
```

- [ ] **Step 3: Verify Types**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/pos/terminal/page.tsx frontend/src/app/pos/terminal/components/PosCatalog.tsx
git commit -m "feat(pos): build terminal layout and product catalog grid"
```

### Task 4: POS Terminal Minuta / Cart

**Files:**
- Create: `frontend/src/app/pos/terminal/components/PosCart.tsx`
- Modify: `frontend/src/app/pos/terminal/page.tsx`

- [ ] **Step 1: Implement POS Cart Component**

```tsx
// frontend/src/app/pos/terminal/components/PosCart.tsx
'use client'

import React from 'react'
import { usePosStore } from '@/store/posStore'
import { Trash2, Plus, Minus, ShoppingCart } from 'lucide-react'

export default function PosCart() {
    const { cart, total, updateQuantity, removeItem, clearCart } = usePosStore()

    return (
        <div className="flex flex-col h-full">
            {/* Cart Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-surface shrink-0 shadow-sm z-10">
                <h2 className="font-bold text-text-primary flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-primary" /> Minuta Actual
                </h2>
                {cart.length > 0 && (
                    <button onClick={clearCart} className="text-xs font-bold text-error hover:text-error-light transition-colors px-2 py-1 rounded hover:bg-error/10">
                        Vaciar
                    </button>
                )}
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center text-text-disabled text-sm mt-20 gap-3">
                        <ShoppingCart className="w-12 h-12 stroke-[1.5]" />
                        <p>La minuta está vacía.<br/>Selecciona productos del catálogo.</p>
                    </div>
                ) : (
                    cart.map(item => (
                        <div key={item.cartItemId} className="flex flex-col gap-2 p-3 bg-surface border border-border rounded-2xl shadow-sm">
                            <div className="flex justify-between items-start">
                                <span className="font-bold text-sm text-text-primary leading-tight pr-2">{item.name}</span>
                                <span className="font-black text-sm text-primary shrink-0">${(Number(item.price) * item.quantity).toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                                <div className="flex items-center bg-surface-raised border border-border rounded-xl overflow-hidden">
                                    <button 
                                        onClick={() => item.quantity > 1 ? updateQuantity(item.cartItemId, item.quantity - 1) : removeItem(item.cartItemId)}
                                        className="p-2 hover:bg-border text-text-secondary hover:text-primary transition-colors"
                                    >
                                        {item.quantity > 1 ? <Minus className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                                    </button>
                                    <span className="text-sm font-bold w-6 text-center select-none">{item.quantity}</span>
                                    <button 
                                        onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                                        className="p-2 hover:bg-border text-text-secondary hover:text-primary transition-colors"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Totals & Actions */}
            <div className="p-4 bg-surface border-t border-border shrink-0 space-y-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="flex items-center justify-between px-1">
                    <span className="text-text-secondary font-bold text-sm uppercase tracking-wider">Total</span>
                    <span className="text-2xl font-black text-text-primary">${total.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button 
                        disabled={cart.length === 0}
                        className="py-3.5 px-4 bg-surface-raised border border-border text-text-primary rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-border transition-colors active:scale-95 shadow-sm"
                    >
                        Cocina
                    </button>
                    <button 
                        disabled={cart.length === 0}
                        className="py-3.5 px-4 bg-primary text-text-inverse rounded-xl font-bold text-sm shadow-sm shadow-primary/20 disabled:opacity-50 hover:bg-primary-hover transition-colors active:scale-95"
                    >
                        Cobrar
                    </button>
                </div>
            </div>
        </div>
    )
}
```

- [ ] **Step 2: Mount PosCart in Terminal Layout**

**Modify:** `frontend/src/app/pos/terminal/page.tsx`

```tsx
// Inside frontend/src/app/pos/terminal/page.tsx

import React from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, UserCircle } from 'lucide-react'
import PosCatalog from './components/PosCatalog'
import PosCart from './components/PosCart'

export default function PosTerminalPage() {
    const router = useRouter()

    return (
        <div className="flex-1 flex flex-col h-full bg-bg">
            {/* Global Header */}
            <header className="h-16 bg-surface border-b border-border flex items-center px-4 justify-between shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.push('/pos/session')} className="p-2 -ml-2 rounded-xl text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <span className="font-bold text-lg text-text-primary">Caja Principal</span>
                </div>
                <div className="flex items-center gap-2 text-sm font-bold text-text-secondary px-3 py-1.5 bg-surface-raised rounded-full border border-border">
                    <UserCircle className="w-4 h-4" />
                    Cajero Activo
                </div>
            </header>

            {/* Split Layout */}
            <div className="flex-1 flex overflow-hidden">
                {/* 70% Left: Catalog / Floor Plans */}
                <div className="flex-1 bg-surface-raised overflow-hidden">
                    <PosCatalog />
                </div>

                {/* 30% Right: Minuta / Cart */}
                <div className="w-[350px] lg:w-[400px] bg-surface border-l border-border flex flex-col shrink-0">
                    <PosCart />
                </div>
            </div>
        </div>
    )
}
```

- [ ] **Step 3: Verify Types**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/pos/terminal/components/PosCart.tsx frontend/src/app/pos/terminal/page.tsx
git commit -m "feat(pos): implement interactive pos cart with zustand integration"
```
