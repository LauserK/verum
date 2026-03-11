'use client'

import { Loader2, Check, WifiOff } from 'lucide-react'
import type { SaveStatus } from '@/hooks/useAutoSave'
import { useTranslations } from '@/components/I18nProvider'

interface Props {
    status: SaveStatus
}

export default function SaveIndicator({ status }: Props) {
    const { t } = useTranslations('saveIndicator')

    if (status === 'idle') return null

    return (
        <div className={`
            flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-all duration-300
            ${status === 'saving' ? 'bg-primary/10 text-primary' : ''}
            ${status === 'saved' ? 'bg-success/10 text-success' : ''}
            ${status === 'error' ? 'bg-error/10 text-error' : ''}
        `}>
            {status === 'saving' && (
                <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>{t('saving')}</span>
                </>
            )}
            {status === 'saved' && (
                <>
                    <Check className="w-3 h-3" />
                    <span>{t('saved')}</span>
                </>
            )}
            {status === 'error' && (
                <>
                    <WifiOff className="w-3 h-3" />
                    <span>{t('error')}</span>
                </>
            )}
        </div>
    )
}
