'use client'

import { useState } from 'react'
import { Plus, Trash2, GripVertical, ChevronUp, ChevronDown } from 'lucide-react'

interface QuestionConfigEditorProps {
    type: string
    config: Record<string, any>
    onChange: (config: Record<string, any>) => void
}

/**
 * Dynamic config editor that renders type-specific fields.
 * 
 * Config schemas:
 * - slider:       { min, max, unit, target_min, target_max }
 * - multi_option: { options: string[] }
 * - select:       { options: string[] }
 * - photo:        { label: string }
 * - check, yes_no, text, number: no config needed
 */
export default function QuestionConfigEditor({ type, config, onChange }: QuestionConfigEditorProps) {
    const [newOption, setNewOption] = useState('')

    // ── Slider ──────────────────────────────────────
    if (type === 'slider') {
        return (
            <div className="space-y-3">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Slider Settings</p>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs text-text-secondary mb-1 block">Min Value</label>
                        <input
                            type="number"
                            value={config.min ?? 0}
                            onChange={(e) => onChange({ ...config, min: Number(e.target.value) })}
                            className="w-full bg-surface border border-border rounded-xl px-3 h-9 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-text-secondary mb-1 block">Max Value</label>
                        <input
                            type="number"
                            value={config.max ?? 100}
                            onChange={(e) => onChange({ ...config, max: Number(e.target.value) })}
                            className="w-full bg-surface border border-border rounded-xl px-3 h-9 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-text-secondary mb-1 block">Unit (optional)</label>
                        <input
                            type="text"
                            placeholder="e.g. °C, kg, %"
                            value={config.unit ?? ''}
                            onChange={(e) => onChange({ ...config, unit: e.target.value })}
                            className="w-full bg-surface border border-border rounded-xl px-3 h-9 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                    </div>
                </div>
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mt-2">Target Range (optional)</p>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs text-text-secondary mb-1 block">Target Min</label>
                        <input
                            type="number"
                            placeholder="—"
                            value={config.target_min ?? ''}
                            onChange={(e) => onChange({ ...config, target_min: e.target.value ? Number(e.target.value) : undefined })}
                            className="w-full bg-surface border border-border rounded-xl px-3 h-9 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-text-secondary mb-1 block">Target Max</label>
                        <input
                            type="number"
                            placeholder="—"
                            value={config.target_max ?? ''}
                            onChange={(e) => onChange({ ...config, target_max: e.target.value ? Number(e.target.value) : undefined })}
                            className="w-full bg-surface border border-border rounded-xl px-3 h-9 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                    </div>
                </div>
            </div>
        )
    }

    // ── Multi Option / Select (shared options editor) ──
    if (type === 'multi_option' || type === 'select') {
        const options: string[] = config.options || []

        const addOption = () => {
            if (!newOption.trim()) return
            onChange({ ...config, options: [...options, newOption.trim()] })
            setNewOption('')
        }

        const removeOption = (idx: number) => {
            onChange({ ...config, options: options.filter((_, i) => i !== idx) })
        }

        const moveOption = (idx: number, direction: 'up' | 'down') => {
            const newOptions = [...options]
            const target = direction === 'up' ? idx - 1 : idx + 1
            if (target < 0 || target >= newOptions.length) return
            ;[newOptions[idx], newOptions[target]] = [newOptions[target], newOptions[idx]]
            onChange({ ...config, options: newOptions })
        }

        const updateOption = (idx: number, value: string) => {
            const newOptions = [...options]
            newOptions[idx] = value
            onChange({ ...config, options: newOptions })
        }

        return (
            <div className="space-y-3">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    {type === 'multi_option' ? 'Options (buttons)' : 'Dropdown Options'}
                </p>

                {options.length === 0 && (
                    <p className="text-xs text-text-disabled italic">No options yet. Add at least one.</p>
                )}

                <div className="space-y-1.5">
                    {options.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 group">
                            <GripVertical className="w-3.5 h-3.5 text-text-disabled flex-shrink-0" />
                            <input
                                value={opt}
                                onChange={(e) => updateOption(idx, e.target.value)}
                                className="flex-1 bg-surface border border-border rounded-lg px-3 h-8 text-sm text-text-primary focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                            />
                            <button
                                onClick={() => moveOption(idx, 'up')}
                                disabled={idx === 0}
                                className="text-text-disabled hover:text-text-secondary disabled:opacity-30 transition-colors p-0.5"
                            >
                                <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => moveOption(idx, 'down')}
                                disabled={idx === options.length - 1}
                                className="text-text-disabled hover:text-text-secondary disabled:opacity-30 transition-colors p-0.5"
                            >
                                <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => removeOption(idx)}
                                className="text-text-disabled hover:text-error transition-colors p-0.5"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))}
                </div>

                <div className="flex gap-2">
                    <input
                        placeholder="New option..."
                        value={newOption}
                        onChange={(e) => setNewOption(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addOption()}
                        className="flex-1 bg-surface border border-border rounded-lg px-3 h-8 text-sm text-text-primary focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                    />
                    <button
                        onClick={addOption}
                        className="flex items-center gap-1 bg-primary/10 text-primary px-3 h-8 rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                </div>
            </div>
        )
    }

    // ── Photo ────────────────────────────────────────
    if (type === 'photo') {
        return (
            <div className="space-y-2">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Photo Settings</p>
                <div>
                    <label className="text-xs text-text-secondary mb-1 block">Label / Caption</label>
                    <input
                        type="text"
                        placeholder="e.g. STATION 1, DINING ROOM"
                        value={config.label ?? ''}
                        onChange={(e) => onChange({ ...config, label: e.target.value })}
                        className="w-full bg-surface border border-border rounded-xl px-3 h-9 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                </div>
            </div>
        )
    }

    // ── No config needed ─────────────────────────────
    return null
}
