'use client'

interface ScheduleEditorProps {
    frequency: string
    schedule: number[]
    onFrequencyChange: (freq: string) => void
    onScheduleChange: (schedule: number[]) => void
}

const FREQUENCIES = [
    { value: 'none', label: 'None', desc: 'Specific date/time only' },
    { value: 'daily', label: 'Daily', desc: 'Every day' },
    { value: 'shift', label: 'Per Shift', desc: 'Every shift' },
    { value: 'weekly', label: 'Weekly', desc: 'One day per week' },
    { value: 'custom', label: 'Custom Days', desc: 'Select specific days' },
    { value: 'monthly', label: 'Monthly', desc: 'Once per month' },
]

const DAYS_OF_WEEK = [
    { value: 0, short: 'Mon', full: 'Monday' },
    { value: 1, short: 'Tue', full: 'Tuesday' },
    { value: 2, short: 'Wed', full: 'Wednesday' },
    { value: 3, short: 'Thu', full: 'Thursday' },
    { value: 4, short: 'Fri', full: 'Friday' },
    { value: 5, short: 'Sat', full: 'Saturday' },
    { value: 6, short: 'Sun', full: 'Sunday' },
]

/**
 * Schedule editor component that adapts based on frequency selection.
 * 
 * schedule field semantics (INT[]):
 * - daily / shift: [] (no schedule needed)
 * - weekly:  [2]     (single day, 0=Mon..6=Sun)
 * - custom:  [1,3]   (multiple days, e.g., Tue+Thu)
 * - monthly: [15]    (day of month, 1-31; 31 = last day)
 */
export default function ScheduleEditor({
    frequency,
    schedule,
    onFrequencyChange,
    onScheduleChange,
}: ScheduleEditorProps) {

    const toggleDay = (day: number) => {
        if (schedule.includes(day)) {
            onScheduleChange(schedule.filter((d) => d !== day))
        } else {
            onScheduleChange([...schedule, day].sort((a, b) => a - b))
        }
    }

    return (
        <div className="space-y-3">
            {/* Frequency select */}
            <div>
                <label className="text-xs text-text-secondary mb-1 block">Frequency</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {FREQUENCIES.map((f) => (
                        <button
                            key={f.value}
                            type="button"
                            onClick={() => {
                                onFrequencyChange(f.value)
                                // Reset schedule when changing frequency
                                if (f.value === 'daily' || f.value === 'shift') {
                                    onScheduleChange([])
                                } else if (f.value === 'weekly' && schedule.length !== 1) {
                                    onScheduleChange([0]) // default to Monday
                                } else if (f.value === 'monthly' && (schedule.length !== 1 || schedule[0] > 31)) {
                                    onScheduleChange([1]) // default to 1st
                                }
                            }}
                            className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all text-left
                                ${frequency === f.value
                                    ? 'bg-primary/10 border-primary text-primary ring-1 ring-primary/30'
                                    : 'bg-surface border-border text-text-primary hover:border-border-strong'
                                }`}
                        >
                            <span className="block font-semibold">{f.label}</span>
                            <span className="block text-[10px] text-text-secondary mt-0.5">{f.desc}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Weekly: single day picker */}
            {frequency === 'weekly' && (
                <div>
                    <label className="text-xs text-text-secondary mb-1.5 block">Which day of the week?</label>
                    <div className="flex gap-1.5 flex-wrap">
                        {DAYS_OF_WEEK.map((d) => (
                            <button
                                key={d.value}
                                type="button"
                                onClick={() => onScheduleChange([d.value])}
                                className={`w-11 h-11 rounded-xl text-xs font-semibold border transition-all
                                    ${schedule.includes(d.value)
                                        ? 'bg-primary text-text-inverse border-primary'
                                        : 'bg-surface border-border text-text-primary hover:border-border-strong'
                                    }`}
                            >
                                {d.short}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Custom: multi day picker */}
            {frequency === 'custom' && (
                <div>
                    <label className="text-xs text-text-secondary mb-1.5 block">Select the days (click to toggle)</label>
                    <div className="flex gap-1.5 flex-wrap">
                        {DAYS_OF_WEEK.map((d) => (
                            <button
                                key={d.value}
                                type="button"
                                onClick={() => toggleDay(d.value)}
                                className={`w-11 h-11 rounded-xl text-xs font-semibold border transition-all
                                    ${schedule.includes(d.value)
                                        ? 'bg-primary text-text-inverse border-primary'
                                        : 'bg-surface border-border text-text-primary hover:border-border-strong'
                                    }`}
                            >
                                {d.short}
                            </button>
                        ))}
                    </div>
                    {schedule.length === 0 && (
                        <p className="text-[10px] text-error mt-1">Select at least one day.</p>
                    )}
                    {schedule.length > 0 && (
                        <p className="text-[10px] text-text-secondary mt-1">
                            {schedule.map((d) => DAYS_OF_WEEK.find((dw) => dw.value === d)?.full).join(', ')}
                        </p>
                    )}
                </div>
            )}

            {/* Monthly: day of month picker */}
            {frequency === 'monthly' && (
                <div>
                    <label className="text-xs text-text-secondary mb-1.5 block">Day of the month</label>
                    <div className="grid grid-cols-7 gap-1.5">
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                            <button
                                key={day}
                                type="button"
                                onClick={() => onScheduleChange([day])}
                                className={`h-9 rounded-lg text-xs font-semibold border transition-all
                                    ${schedule.includes(day)
                                        ? 'bg-primary text-text-inverse border-primary'
                                        : 'bg-surface border-border text-text-primary hover:border-border-strong'
                                    }`}
                            >
                                {day}
                            </button>
                        ))}
                    </div>
                    {schedule.includes(31) && (
                        <p className="text-[10px] text-text-secondary mt-1.5">
                            ℹ️ Day 31 = last day of the month (30th in short months, 28/29th in February).
                        </p>
                    )}
                    {schedule.includes(30) && !schedule.includes(31) && (
                        <p className="text-[10px] text-text-secondary mt-1.5">
                            ℹ️ In February, this will be adjusted to the 28th or 29th.
                        </p>
                    )}
                    {schedule.includes(29) && !schedule.includes(30) && !schedule.includes(31) && (
                        <p className="text-[10px] text-text-secondary mt-1.5">
                            ℹ️ In non-leap year February, this will be adjusted to the 28th.
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}

export { FREQUENCIES, DAYS_OF_WEEK }
