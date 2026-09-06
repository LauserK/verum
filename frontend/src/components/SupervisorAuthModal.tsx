'use client'

import React, { useState, useEffect, useRef } from 'react'
import { ShieldCheck, Lock, Scan, KeyRound, AlertCircle, Loader2, X, CheckCircle2 } from 'lucide-react'
import { adminApi } from '@/lib/api'

interface SupervisorAuthModalProps {
  isOpen: boolean
  title?: string
  description?: string
  permissionKey: string // e.g. 'pos.create_cxc'
  onAuthorized: (supervisorInfo: { supervisorId?: string; supervisorName?: string }) => void
  onCancel: () => void
}

export function SupervisorAuthModal({
  isOpen,
  title = 'Autorización Requerida',
  description = 'Esta acción requiere autorización de un supervisor o administrador.',
  permissionKey,
  onAuthorized,
  onCancel
}: SupervisorAuthModalProps) {
  const [pin, setPin] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input automatically when modal opens
  useEffect(() => {
    if (isOpen) {
      setPin('')
      setErrorMessage(null)
      setSuccessMessage(null)
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [isOpen])

  // Handle hardware barcode / RFID scanner input buffer (scanners usually type fast & press Enter)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && pin.trim().length >= 4) {
      e.preventDefault()
      handleVerify(pin.trim())
    }
  }

  const handleVerify = async (credentialToVerify: string) => {
    if (!credentialToVerify || credentialToVerify.length < 4) {
      setErrorMessage('Ingresa un PIN válido (mínimo 4 dígitos) o escanea tu credencial.')
      return
    }

    setIsVerifying(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const res = await adminApi.authorizeAction({
        credential: credentialToVerify,
        permission_key: permissionKey
      })

      if (res.authorized) {
        setSuccessMessage(`Autorizado por: ${res.supervisor_name || 'Supervisor'}`)
        setTimeout(() => {
          onAuthorized({
            supervisorId: res.supervisor_id,
            supervisorName: res.supervisor_name
          })
        }, 500)
      } else {
        setErrorMessage(res.message || 'Credencial o PIN sin permisos suficientes.')
        setPin('')
        inputRef.current?.focus()
      }
    } catch (err: any) {
      console.error('Authorization error:', err)
      setErrorMessage(err?.message || 'Error al validar credencial de autorización.')
      setPin('')
      inputRef.current?.focus()
    } finally {
      setIsVerifying(false)
    }
  }

  const handleNumClick = (digit: string) => {
    if (pin.length < 6) {
      const newPin = pin + digit
      setPin(newPin)
      if (newPin.length >= 4) {
        // Option to verify automatically when 6 digits, or user can click verify
        if (newPin.length === 6) {
          handleVerify(newPin)
        }
      }
    }
  }

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1))
    setErrorMessage(null)
  }

  const handleClear = () => {
    setPin('')
    setErrorMessage(null)
    inputRef.current?.focus()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="bg-surface border border-border shadow-2xl rounded-3xl w-full max-w-sm sm:max-w-md overflow-hidden flex flex-col scale-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-surface-raised/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary">{title}</h2>
              <p className="text-xs text-text-secondary">Permiso: {permissionKey}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isVerifying}
            className="p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-xs sm:text-sm text-text-secondary text-center">
            {description}
          </p>

          {/* Scanner / RFID / PIN Input */}
          <div className="relative">
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              maxLength={12}
              value={pin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '')
                setPin(val)
                if (val.length === 6) {
                  handleVerify(val)
                }
              }}
              onKeyDown={handleKeyDown}
              disabled={isVerifying}
              placeholder="••••"
              className="w-full h-14 bg-surface-raised border border-border rounded-2xl px-12 text-center text-2xl tracking-[0.4em] font-mono font-bold text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:tracking-normal placeholder:text-text-tertiary"
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary">
              <KeyRound className="w-5 h-5" />
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary" title="Soporta lector Barcode / RFID / NFC">
              <Scan className="w-5 h-5 opacity-60" />
            </div>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-text-secondary">
            <Scan className="w-3.5 h-3.5 text-primary" />
            <span>Puedes teclear el PIN o escanear con Lector Barcode/NFC</span>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2 text-xs text-rose-400 animate-in fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-xs text-emerald-400 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Interactive Numpad for Touchscreens */}
          <div className="grid grid-cols-3 gap-2 pt-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                type="button"
                disabled={isVerifying}
                onClick={() => handleNumClick(num.toString())}
                className="h-12 rounded-xl bg-surface-raised hover:bg-surface border border-border/80 text-base font-bold text-text-primary transition-all active:scale-95 hover:border-primary/40 disabled:opacity-50"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              disabled={isVerifying || pin.length === 0}
              onClick={handleClear}
              className="h-12 rounded-xl bg-surface-raised hover:bg-surface border border-border/80 text-xs font-semibold text-text-secondary transition-all active:scale-95 disabled:opacity-50"
            >
              C
            </button>
            <button
              type="button"
              disabled={isVerifying}
              onClick={() => handleNumClick('0')}
              className="h-12 rounded-xl bg-surface-raised hover:bg-surface border border-border/80 text-base font-bold text-text-primary transition-all active:scale-95 hover:border-primary/40 disabled:opacity-50"
            >
              0
            </button>
            <button
              type="button"
              disabled={isVerifying || pin.length === 0}
              onClick={handleBackspace}
              className="h-12 rounded-xl bg-surface-raised hover:bg-surface border border-border/80 text-xs font-semibold text-text-secondary transition-all active:scale-95 disabled:opacity-50"
            >
              ?
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-surface-raised/40 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isVerifying}
            className="flex-1 h-11 rounded-xl border border-border text-text-primary text-xs sm:text-sm font-semibold hover:bg-surface-raised transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => handleVerify(pin)}
            disabled={isVerifying || pin.length < 4}
            className="flex-1 h-11 rounded-xl bg-primary text-text-inverse text-xs sm:text-sm font-semibold hover:bg-primary-hover transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-lg shadow-primary/20"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Validando...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Autorizar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
