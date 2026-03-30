'use client'

import { useState, useRef } from 'react'
import { Camera, Loader2, X } from 'lucide-react'
import imageCompression from 'browser-image-compression'
import { createClient } from '@/utils/supabase/client'
import type { SubmissionQuestion } from '@/lib/api'
import { useTranslations } from '@/components/I18nProvider'

interface Props {
    question: SubmissionQuestion
    value: string | null
    onChange: (value: string) => void
}

export default function PhotoQuestion({ question, value, onChange }: Props) {
    const { t } = useTranslations('questions')
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        setError(null)

        try {
            // Compress image to < 200KB
            const compressed = await imageCompression(file, {
                maxSizeMB: 0.2,
                maxWidthOrHeight: 1280,
                useWebWorker: true,
            })

            // Generate unique filename
            const ext = compressed.type.split('/')[1] || 'jpg'
            const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
            const path = `checklist-photos/${filename}`

            // Upload to Supabase Storage
            const supabase = createClient()
            const { error: uploadError } = await supabase.storage
                .from('checklist-photos')
                .upload(path, compressed, {
                    contentType: compressed.type,
                    upsert: false,
                })

            if (uploadError) throw uploadError

            // Get public URL
            const { data: urlData } = supabase.storage
                .from('checklist-photos')
                .getPublicUrl(path)

            onChange(urlData.publicUrl)
        } catch (err: unknown) {
            console.error('Photo upload error:', err)
            setError(t('photoUploadError'))
        } finally {
            setUploading(false)
            // Reset input so the same file can be re-selected
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleRemove = () => {
        onChange('')
        setError(null)
    }

    const isUrl = value && value.startsWith('http')

    return (
        <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm dark:shadow-none">
            <h3 className="text-base font-semibold text-text-primary mb-1">{question.label}</h3>
            {(question.config as any)?.label && (
                <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">{(question.config as any).label}</p>
            )}

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleCapture}
                className="hidden"
            />

            {/* Uploading state */}
            {uploading && (
                <div className="aspect-video rounded-xl bg-surface-raised flex flex-col items-center justify-center gap-2 border border-border">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <span className="text-sm text-text-secondary font-medium">{t('photoUploading')}</span>
                </div>
            )}

            {/* Photo preview */}
            {!uploading && isUrl && (
                <div className="relative rounded-xl overflow-hidden">
                    <img
                        src={value!}
                        alt={question.label}
                        className="w-full aspect-video object-cover rounded-xl"
                    />
                    <button
                        type="button"
                        onClick={handleRemove}
                        className="absolute top-2 right-2 w-8 h-8 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Placeholder value from M3 */}
            {!uploading && value && !isUrl && (
                <div className="relative rounded-xl overflow-hidden bg-surface-raised">
                    <div className="aspect-video flex items-center justify-center bg-success/10 border border-success/20 rounded-xl">
                        <div className="text-center">
                            <Camera className="w-8 h-8 text-success mx-auto mb-1" />
                            <p className="text-sm font-medium text-success">{t('photoCaptured')}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleRemove}
                        className="mt-2 text-xs text-error hover:text-error/80 transition-colors"
                    >
                        {t('photoRemove')}
                    </button>
                </div>
            )}

            {/* Empty state — tap to capture */}
            {!uploading && !value && (
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full aspect-video rounded-xl border-2 border-dashed border-border-strong hover:border-primary/50 flex flex-col items-center justify-center gap-2 text-text-secondary hover:text-primary transition-all cursor-pointer bg-surface-raised/50"
                >
                    <Camera className="w-8 h-8" />
                    <span className="text-sm font-medium">{t('photoTapToTake')}</span>
                </button>
            )}

            {/* Error */}
            {error && (
                <p className="text-xs text-error mt-2">{error}</p>
            )}
        </div>
    )
}
