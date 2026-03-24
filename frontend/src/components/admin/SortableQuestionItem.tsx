import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Edit3, Trash2 } from 'lucide-react';
import { Question } from '@/lib/api';

interface SortableQuestionItemProps {
    question: Question;
    onEdit: (q: Question) => void;
    onDelete: (id: string) => void;
}

export function SortableQuestionItem({ question: q, onEdit, onDelete }: SortableQuestionItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: q.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div 
            ref={setNodeRef} 
            style={style} 
            className={`bg-surface border rounded-2xl p-4 flex items-start justify-between gap-3 relative transition-colors
                ${isDragging ? 'border-primary shadow-lg ring-2 ring-primary/10 z-10' : 'border-border'}
            `}
        >
            <div className="flex items-start gap-2 min-w-0 flex-1">
                <div {...attributes} {...listeners} className="cursor-grab hover:text-primary transition-colors touch-none py-1 px-0.5">
                    <GripVertical className="w-4 h-4 text-text-disabled flex-shrink-0" />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary">{q.label}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">
                            {q.type}
                        </span>
                        {q.is_required && (
                            <span className="text-[10px] font-medium text-error">Required</span>
                        )}
                        {q.config && (
                            <span className="text-[10px] text-text-secondary">config ✓</span>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
                <button
                    onClick={(e) => { e.stopPropagation(); onEdit(q); }}
                    className="text-text-secondary hover:text-primary transition-colors p-1"
                >
                    <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(q.id); }}
                    className="text-text-secondary hover:text-error transition-colors p-1"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}
