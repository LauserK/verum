'use client'

import { useEffect, useState } from 'react'
import {
    adminApi, getProfile,
    type Profile, type TemplateDetail, type Question
} from '@/lib/api'
import {
    Plus, Trash2, Edit3, ChevronRight, Save, X, Loader2,
    GripVertical
} from 'lucide-react'
import QuestionConfigEditor from '@/components/admin/QuestionConfigEditor'
import ScheduleEditor from '@/components/admin/ScheduleEditor'

const QUESTION_TYPES = [
    { value: 'check', label: 'Check ✓' },
    { value: 'yes_no', label: 'Yes / No' },
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'slider', label: 'Slider' },
    { value: 'multi_option', label: 'Multi Option' },
    { value: 'select', label: 'Select' },
    { value: 'photo', label: 'Photo' },
]


export default function TemplatesPage() {
    const [profile, setProfile] = useState<Profile | null>(null)
    const [venueId, setVenueId] = useState('')
    const [templates, setTemplates] = useState<TemplateDetail[]>([])
    const [selectedTemplate, setSelectedTemplate] = useState<TemplateDetail | null>(null)
    const [questions, setQuestions] = useState<Question[]>([])
    const [loading, setLoading] = useState(true)

    // New template form
    const [showNewTemplate, setShowNewTemplate] = useState(false)
    const [newTitle, setNewTitle] = useState('')
    const [newDesc, setNewDesc] = useState('')
    const [newFreq, setNewFreq] = useState('daily')
    const [newSchedule, setNewSchedule] = useState<number[]>([])
    const [newDueDate, setNewDueDate] = useState('')
    const [newDueTime, setNewDueTime] = useState('')
    const [newAvailableTime, setNewAvailableTime] = useState('')
    const [newPrereq, setNewPrereq] = useState('')
    const [saving, setSaving] = useState(false)

    // Edit template
    const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
    const [etTitle, setEtTitle] = useState('')
    const [etDesc, setEtDesc] = useState('')
    const [etFreq, setEtFreq] = useState('daily')
    const [etSchedule, setEtSchedule] = useState<number[]>([])
    const [etDueDate, setEtDueDate] = useState('')
    const [etDueTime, setEtDueTime] = useState('')
    const [etAvailableTime, setEtAvailableTime] = useState('')
    const [etPrereq, setEtPrereq] = useState('')

    // Question form
    const [showNewQuestion, setShowNewQuestion] = useState(false)
    const [qLabel, setQLabel] = useState('')
    const [qType, setQType] = useState('check')
    const [qRequired, setQRequired] = useState(true)
    const [qConfig, setQConfig] = useState<Record<string, any>>({})

    // Edit question
    const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null)
    const [eqLabel, setEqLabel] = useState('')
    const [eqType, setEqType] = useState('check')
    const [eqRequired, setEqRequired] = useState(true)
    const [eqConfig, setEqConfig] = useState<Record<string, any>>({})

    useEffect(() => {
        async function load() {
            try {
                const p = await getProfile()
                setProfile(p)
                if (p.venues.length > 0) setVenueId(p.venues[0].id)
            } catch { }
            setLoading(false)
        }
        load()
    }, [])

    useEffect(() => {
        if (!venueId) return
        setLoading(true)
        adminApi.getTemplates(venueId)
            .then(setTemplates)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [venueId])

    const loadQuestions = async (tmpl: TemplateDetail) => {
        setSelectedTemplate(tmpl)
        const qs = await adminApi.getQuestions(tmpl.id)
        setQuestions(qs)
    }

    const handleCreateTemplate = async () => {
        if (!newTitle.trim()) return
        setSaving(true)
        try {
            const tmpl = await adminApi.createTemplate({
                venue_id: venueId,
                title: newTitle,
                description: newDesc || undefined,
                frequency: newFreq,
                schedule: newSchedule.length > 0 ? newSchedule : undefined,
                due_date: newDueDate || undefined,
                due_time: newDueTime || undefined,
                available_from_time: newAvailableTime || undefined,
                prerequisite_template_id: newPrereq || undefined,
            })
            setTemplates((prev) => [...prev, tmpl])
            setShowNewTemplate(false)
            setNewTitle('')
            setNewDesc('')
            setNewDueDate('')
            setNewDueTime('')
            setNewAvailableTime('')
            setNewSchedule([])
            setNewFreq('daily')
            setNewPrereq('')
        } catch (err) {
            console.error(err)
        }
        setSaving(false)
    }

    const startEditTemplate = (t: TemplateDetail, e: React.MouseEvent) => {
        e.stopPropagation()
        setEditingTemplateId(t.id)
        setEtTitle(t.title)
        setEtDesc(t.description || '')
        setEtFreq(t.frequency || 'daily')
        setEtSchedule(t.schedule || [])
        setEtDueDate(t.due_date || '')
        setEtDueTime(t.due_time || '')
        setEtAvailableTime(t.available_from_time || '')
        setEtPrereq(t.prerequisite_template_id || '')
    }

    const handleUpdateTemplate = async () => {
        if (!editingTemplateId || !etTitle.trim()) return
        setSaving(true)
        try {
            const updated = await adminApi.updateTemplate(editingTemplateId, {
                venue_id: venueId,
                title: etTitle,
                description: etDesc || undefined,
                frequency: etFreq,
                schedule: etSchedule.length > 0 ? etSchedule : null,
                due_date: etDueDate || null,
                due_time: etDueTime || null,
                available_from_time: etAvailableTime || null,
                prerequisite_template_id: etPrereq || null,
            } as Partial<TemplateDetail>)
            setTemplates((prev) => prev.map((t) => t.id === editingTemplateId ? { ...t, ...updated } : t))
            if (selectedTemplate?.id === editingTemplateId) {
                setSelectedTemplate((prev) => prev ? { ...prev, ...updated } : prev)
            }
            setEditingTemplateId(null)
        } catch (err) {
            console.error(err)
        }
        setSaving(false)
    }

    const handleDeleteTemplate = async (id: string) => {
        if (!confirm('Delete this template and all its questions?')) return
        await adminApi.deleteTemplate(id)
        setTemplates((prev) => prev.filter((t) => t.id !== id))
        if (selectedTemplate?.id === id) {
            setSelectedTemplate(null)
            setQuestions([])
        }
    }

    const handleCreateQuestion = async () => {
        if (!qLabel.trim() || !selectedTemplate) return
        setSaving(true)
        try {
            const hasConfig = Object.keys(qConfig).length > 0
            const q = await adminApi.createQuestion({
                template_id: selectedTemplate.id,
                label: qLabel,
                type: qType,
                is_required: qRequired,
                config: hasConfig ? qConfig : null,
                sort_order: questions.length,
            })
            setQuestions((prev) => [...prev, q])
            setShowNewQuestion(false)
            setQLabel('')
            setQConfig({})
        } catch (err) {
            console.error(err)
        }
        setSaving(false)
    }

    const handleDeleteQuestion = async (id: string) => {
        await adminApi.deleteQuestion(id)
        setQuestions((prev) => prev.filter((q) => q.id !== id))
    }

    const startEditQuestion = (q: Question) => {
        setEditingQuestionId(q.id)
        setEqLabel(q.label)
        setEqType(q.type)
        setEqRequired(q.is_required)
        setEqConfig(q.config ? { ...q.config } : {})
    }

    const handleUpdateQuestion = async () => {
        if (!editingQuestionId || !eqLabel.trim() || !selectedTemplate) return
        setSaving(true)
        try {
            const hasConfig = Object.keys(eqConfig).length > 0
            const updated = await adminApi.updateQuestion(editingQuestionId, {
                template_id: selectedTemplate.id,
                label: eqLabel,
                type: eqType,
                is_required: eqRequired,
                config: hasConfig ? eqConfig : null,
                sort_order: questions.findIndex(q => q.id === editingQuestionId),
            })
            setQuestions((prev) => prev.map((q) => q.id === editingQuestionId ? { ...q, ...updated } : q))
            setEditingQuestionId(null)
        } catch (err) {
            console.error(err)
        }
        setSaving(false)
    }

    if (loading && !profile) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary mb-1">{t('nav.templates')}</h1>
                    <div className="flex items-center gap-6 mt-2 overflow-x-auto">
                        <Link href="/admin/checklists/dashboard" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors whitespace-nowrap">
                            Dashboard
                        </Link>
                        <span className="text-sm font-semibold text-primary border-b-2 border-primary pb-1 whitespace-nowrap">{t('nav.templates')}</span>
                        <Link href="/admin/submissions" className="text-sm font-medium text-text-secondary hover:text-text-primary pb-1 border-b-2 border-transparent hover:border-border transition-colors whitespace-nowrap">
                            {t('nav.submissions')}
                        </Link>
                    </div>
                </div>
            </div>

            {/* Venue Selector */}
            <div className="flex items-center gap-3">
                <select
                    value={venueId}
                    onChange={(e) => { setVenueId(e.target.value); setSelectedTemplate(null); setQuestions([]) }}
                    className="bg-surface border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                >
                    {profile?.venues.map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                </select>
                <button
                    onClick={() => setShowNewTemplate(true)}
                    className="flex items-center gap-1.5 bg-primary text-text-inverse px-4 h-10 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors"
                >
                    <Plus className="w-4 h-4" /> New Template
                </button>
            </div>

            {/* New Template Form */}
            {showNewTemplate && (
                <div className="bg-surface border border-primary/30 rounded-2xl p-5 space-y-4">
                    <h3 className="text-sm font-bold text-text-primary">New Checklist Template</h3>
                    <input
                        placeholder="Title"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        className="w-full bg-surface border border-border rounded-xl px-4 h-10 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                    <input
                        placeholder="Description (optional)"
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        className="w-full bg-surface border border-border rounded-xl px-4 h-10 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                    <ScheduleEditor
                        frequency={newFreq}
                        schedule={newSchedule}
                        onFrequencyChange={setNewFreq}
                        onScheduleChange={setNewSchedule}
                    />
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-xs text-text-secondary mb-1 block">Due Date (optional)</label>
                            <input
                                type="date"
                                value={newDueDate}
                                onChange={(e) => setNewDueDate(e.target.value)}
                                className="bg-surface border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary outline-none w-full"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-text-secondary mb-1 block">Due Time (optional)</label>
                            <input
                                type="time"
                                value={newDueTime}
                                onChange={(e) => setNewDueTime(e.target.value)}
                                className="bg-surface border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary outline-none w-full"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-text-secondary mb-1 block">Available From (optional)</label>
                            <input
                                type="time"
                                value={newAvailableTime}
                                onChange={(e) => setNewAvailableTime(e.target.value)}
                                className="bg-surface border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary outline-none w-full"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-text-secondary mb-1 block">Prerequisite Checklist (optional)</label>
                        <select
                            value={newPrereq}
                            onChange={(e) => setNewPrereq(e.target.value)}
                            className="bg-surface border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary outline-none w-full"
                        >
                            <option value="">None</option>
                            {templates.map(t => (
                                <option key={t.id} value={t.id}>{t.title}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleCreateTemplate}
                            disabled={saving}
                            className="flex items-center gap-1.5 bg-primary text-text-inverse px-4 h-10 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Create'}
                        </button>
                        <button
                            onClick={() => setShowNewTemplate(false)}
                            className="flex items-center gap-1.5 border border-border text-text-primary px-4 h-10 rounded-xl text-sm font-medium hover:bg-surface-raised transition-colors"
                        >
                            <X className="w-4 h-4" /> Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Two-Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Templates List */}
                <div className="space-y-3">
                    <h2 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Templates</h2>
                    {loading ? (
                        <div className="text-center py-10 text-text-secondary text-sm">Loading...</div>
                    ) : templates.length === 0 ? (
                        <div className="text-center py-10 text-text-secondary text-sm">No templates yet. Create one above.</div>
                    ) : (
                        templates.map((t) => (
                            <div
                                key={t.id}
                                className={`bg-surface border rounded-2xl p-4 transition-all
                                    ${selectedTemplate?.id === t.id
                                        ? 'border-primary shadow-md ring-2 ring-primary/20'
                                        : 'border-border hover:border-border-strong'
                                    }`}
                            >
                                {editingTemplateId === t.id ? (
                                    /* Inline Edit Form */
                                    <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            value={etTitle}
                                            onChange={(e) => setEtTitle(e.target.value)}
                                            placeholder="Title"
                                            className="w-full bg-surface border border-border rounded-xl px-4 h-10 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                                        />
                                        <input
                                            value={etDesc}
                                            onChange={(e) => setEtDesc(e.target.value)}
                                            placeholder="Description (optional)"
                                            className="w-full bg-surface border border-border rounded-xl px-4 h-10 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                                        />
                                        <ScheduleEditor
                                            frequency={etFreq}
                                            schedule={etSchedule}
                                            onFrequencyChange={setEtFreq}
                                            onScheduleChange={setEtSchedule}
                                        />
                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                            <div>
                                                <label className="text-xs text-text-secondary mb-1 block">Due Date (optional)</label>
                                                <input
                                                    type="date"
                                                    value={etDueDate}
                                                    onChange={(e) => setEtDueDate(e.target.value)}
                                                    className="bg-surface border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary outline-none w-full"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-text-secondary mb-1 block">Due Time (optional)</label>
                                                <input
                                                    type="time"
                                                    value={etDueTime}
                                                    onChange={(e) => setEtDueTime(e.target.value)}
                                                    className="bg-surface border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary outline-none w-full"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-text-secondary mb-1 block">Available From (optional)</label>
                                                <input
                                                    type="time"
                                                    value={etAvailableTime}
                                                    onChange={(e) => setEtAvailableTime(e.target.value)}
                                                    className="bg-surface border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary outline-none w-full"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs text-text-secondary mb-1 block">Prerequisite Checklist (optional)</label>
                                            <select
                                                value={etPrereq}
                                                onChange={(e) => setEtPrereq(e.target.value)}
                                                className="bg-surface border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary outline-none w-full"
                                            >
                                                <option value="">None</option>
                                                {templates.filter(temp => temp.id !== t.id).map(temp => (
                                                    <option key={temp.id} value={temp.id}>{temp.title}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleUpdateTemplate}
                                                disabled={saving}
                                                className="flex items-center gap-1.5 bg-primary text-text-inverse px-4 h-9 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
                                            >
                                                <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}
                                            </button>
                                            <button
                                                onClick={() => setEditingTemplateId(null)}
                                                className="flex items-center gap-1.5 border border-border text-text-primary px-4 h-9 rounded-xl text-sm font-medium hover:bg-surface-raised transition-colors"
                                            >
                                                <X className="w-3.5 h-3.5" /> Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* Read-only View */
                                    <div
                                        className="flex items-center justify-between cursor-pointer"
                                        onClick={() => loadQuestions(t)}
                                    >
                                        <div className="min-w-0">
                                            <h3 className="text-sm font-semibold text-text-primary truncate">{t.title}</h3>
                                            <p className="text-xs text-text-secondary mt-0.5">
                                                {t.frequency === 'custom' && t.schedule?.length
                                                    ? t.schedule.map((d) => ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][d]).join(', ')
                                                    : t.frequency === 'weekly' && t.schedule?.length
                                                        ? `Weekly · ${['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][t.schedule[0]]}`
                                                        : t.frequency === 'monthly' && t.schedule?.length
                                                            ? `Monthly · Day ${t.schedule[0]}${t.schedule[0] === 31 ? ' (last day)' : ''}`
                                                            : t.frequency || 'daily'}
                                                {t.due_date && ` · Date: ${t.due_date}`}
                                                {t.available_from_time && ` · From ${t.available_from_time}`}
                                                {t.due_time && ` · Due ${t.due_time}`}
                                            </p>
                                            {t.prerequisite_template_id && (
                                                <p className="text-[10px] text-text-secondary mt-1 bg-surface-raised inline-block px-1.5 py-0.5 rounded">
                                                    🔒 Prerequisite: {templates.find(temp => temp.id === t.prerequisite_template_id)?.title || 'Unknown Checklist'}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <button
                                                onClick={(e) => startEditTemplate(t, e)}
                                                className="text-text-secondary hover:text-primary transition-colors p-1"
                                            >
                                                <Edit3 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id) }}
                                                className="text-text-secondary hover:text-error transition-colors p-1"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                            <ChevronRight className="w-4 h-4 text-text-secondary" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Questions Editor */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold text-text-secondary uppercase tracking-wider">
                            {selectedTemplate ? `Questions — ${selectedTemplate.title}` : 'Questions'}
                        </h2>
                        {selectedTemplate && (
                            <button
                                onClick={() => setShowNewQuestion(true)}
                                className="flex items-center gap-1 text-xs text-primary font-medium hover:text-primary-hover transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" /> Add
                            </button>
                        )}
                    </div>

                    {!selectedTemplate ? (
                        <div className="text-center py-10 text-text-secondary text-sm">Select a template to see its questions.</div>
                    ) : questions.length === 0 && !showNewQuestion ? (
                        <div className="text-center py-10 text-text-secondary text-sm">No questions yet.</div>
                    ) : (
                        <>
                            {questions.map((q, idx) => (
                                <div key={q.id} className="bg-surface border border-border rounded-2xl p-4">
                                    {editingQuestionId === q.id ? (
                                        /* Inline Edit Form */
                                        <div className="space-y-3">
                                            <input
                                                value={eqLabel}
                                                onChange={(e) => setEqLabel(e.target.value)}
                                                className="w-full bg-surface border border-border rounded-xl px-4 h-10 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                                            />
                                            <div className="flex gap-3">
                                                <select
                                                    value={eqType}
                                                    onChange={(e) => setEqType(e.target.value)}
                                                    className="bg-surface border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary outline-none flex-1"
                                                >
                                                    {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                                </select>
                                                <label className="flex items-center gap-2 text-sm text-text-primary">
                                                    <input type="checkbox" checked={eqRequired} onChange={(e) => setEqRequired(e.target.checked)} className="accent-primary" />
                                                    Required
                                                </label>
                                            </div>
                                            <QuestionConfigEditor type={eqType} config={eqConfig} onChange={setEqConfig} />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleUpdateQuestion}
                                                    disabled={saving}
                                                    className="flex items-center gap-1.5 bg-primary text-text-inverse px-4 h-9 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
                                                >
                                                    <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}
                                                </button>
                                                <button
                                                    onClick={() => setEditingQuestionId(null)}
                                                    className="flex items-center gap-1.5 border border-border text-text-primary px-4 h-9 rounded-xl text-sm font-medium hover:bg-surface-raised transition-colors"
                                                >
                                                    <X className="w-3.5 h-3.5" /> Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* Read-only View */
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-2 min-w-0">
                                                <GripVertical className="w-4 h-4 text-text-disabled flex-shrink-0 mt-0.5" />
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
                                                    onClick={() => startEditQuestion(q)}
                                                    className="text-text-secondary hover:text-primary transition-colors p-1"
                                                >
                                                    <Edit3 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteQuestion(q.id)}
                                                    className="text-text-secondary hover:text-error transition-colors p-1"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </>
                    )}

                    {/* New Question Form */}
                    {showNewQuestion && (
                        <div className="bg-surface border border-primary/30 rounded-2xl p-5 space-y-3">
                            <input
                                placeholder="Question label"
                                value={qLabel}
                                onChange={(e) => setQLabel(e.target.value)}
                                className="w-full bg-surface border border-border rounded-xl px-4 h-10 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                            />
                            <div className="flex gap-3">
                                <select
                                    value={qType}
                                    onChange={(e) => setQType(e.target.value)}
                                    className="bg-surface border border-border rounded-xl px-3 h-10 text-sm text-text-primary focus:border-primary outline-none flex-1"
                                >
                                    {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                                <label className="flex items-center gap-2 text-sm text-text-primary">
                                    <input type="checkbox" checked={qRequired} onChange={(e) => setQRequired(e.target.checked)} className="accent-primary" />
                                    Required
                                </label>
                            </div>
                            <QuestionConfigEditor type={qType} config={qConfig} onChange={setQConfig} />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCreateQuestion}
                                    disabled={saving}
                                    className="flex items-center gap-1.5 bg-primary text-text-inverse px-4 h-10 rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
                                >
                                    <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Add Question'}
                                </button>
                                <button
                                    onClick={() => setShowNewQuestion(false)}
                                    className="flex items-center gap-1.5 border border-border text-text-primary px-4 h-10 rounded-xl text-sm font-medium hover:bg-surface-raised transition-colors"
                                >
                                    <X className="w-4 h-4" /> Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
