// frontend/src/hooks/usePendingTasks.ts
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { getProfile } from '@/lib/api'

export function usePendingTasks() {
    const [hasPendingChecklists, setHasPendingChecklists] = useState(false)
    const [hasPendingInventory, setHasPendingInventory] = useState(false)
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        async function checkPendingTasks() {
            try {
                const profile = await getProfile()
                if (!profile.venue_id) return

                // 1. Check pending checklists
                // A checklist is pending if status is 'pending' for the current venue
                const { data: checklists } = await supabase
                    .from('checklists')
                    .select('id, status')
                    .eq('venue_id', profile.venue_id)
                    .eq('status', 'pending')
                    .limit(1)

                setHasPendingChecklists(!!checklists && checklists.length > 0)

                // 2. Check pending inventory (count_schedules)
                // A schedule is due if next_due <= today
                const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD
                const { data: schedules } = await supabase
                    .from('count_schedules')
                    .select('id')
                    .eq('venue_id', profile.venue_id)
                    .lte('next_due', today)
                    .limit(1)

                setHasPendingInventory(!!schedules && schedules.length > 0)

            } catch (err) {
                console.error('Error checking pending tasks:', err)
            } finally {
                setLoading(false)
            }
        }

        checkPendingTasks()
        
        // Optional: Refresh every 5 minutes
        const interval = setInterval(checkPendingTasks, 5 * 60 * 1000)
        return () => clearInterval(interval)
    }, [supabase])

    return { hasPendingChecklists, hasPendingInventory, loading }
}
