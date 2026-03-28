// frontend/src/hooks/usePendingTasks.ts
import { useState, useEffect, useCallback } from 'react'
import { getProfile, getChecklists, getDueSchedules } from '@/lib/api'

export function usePendingTasks() {
    const [hasPendingChecklists, setHasPendingChecklists] = useState(false)
    const [hasPendingInventory, setHasPendingInventory] = useState(false)
    const [loading, setLoading] = useState(true)

    const checkPendingTasks = useCallback(async () => {
        try {
            const profile = await getProfile()
            if (!profile.venue_id) return

            // 1. Check pending checklists using the calculated status from API
            const checklists = await getChecklists(profile.venue_id)
            const hasPending = checklists.some(c => c.status === 'pending')
            setHasPendingChecklists(hasPending)

            // 2. Check pending inventory (due schedules) from API
            const dueSchedules = await getDueSchedules(profile.venue_id)
            setHasPendingInventory(dueSchedules.length > 0)

        } catch (err) {
            console.error('Error checking pending tasks:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        checkPendingTasks()
        
        // Refresh every 5 minutes
        const interval = setInterval(checkPendingTasks, 5 * 60 * 1000)
        return () => clearInterval(interval)
    }, [checkPendingTasks])

    return { hasPendingChecklists, hasPendingInventory, loading }
}
