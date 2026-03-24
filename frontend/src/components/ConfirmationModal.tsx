import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ConfirmationModal({
    isOpen,
    title,
    message,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel
}: ConfirmationModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-border animate-in zoom-in-95 duration-200">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4 text-primary">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <AlertCircle className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-text-primary">{title}</h3>
                    </div>
                    
                    <p className="text-text-secondary text-sm leading-relaxed mb-8">
                        {message}
                    </p>

                    <div className="flex flex-col gap-2">
                        <button
                            onClick={onConfirm}
                            className="w-full h-12 bg-primary text-text-inverse rounded-2xl font-bold text-sm hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20"
                        >
                            {confirmLabel}
                        </button>
                        <button
                            onClick={onCancel}
                            className="w-full h-12 bg-surface-raised text-text-primary rounded-2xl font-bold text-sm hover:bg-border/20 transition-colors"
                        >
                            {cancelLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
