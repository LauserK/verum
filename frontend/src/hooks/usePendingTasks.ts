// frontend/src/hooks/usePendingTasks.ts
import { useState, useEffect, useCallback } from 'react'
import { getProfile, getChecklists, getDueSchedules } from '@/lib/api'
import { useVenue } from '@/components/VenueContext'

export function usePendingTasks() {
    const { selectedVenueId } = useVenue()
    const [hasPendingChecklists, setHasPendingChecklists] = useState(false)
    const [hasPendingInventory, setHasPendingInventory] = useState(false)
    const [loading, setLoading] = useState(true)

    const checkPendingTasks = useCallback(async () => {
        try {
            // Use selectedVenueId from context if available, otherwise fallback to profile venue
            let venueId = selectedVenueId
            
            if (!venueId) {
                const profile = await getProfile()
                venueId = profile.venue_id
            }
            
            if (!venueId) {
                setHasPendingChecklists(false)
                setHasPendingInventory(false)
                setLoading(false)
                return
            }

            // 1. Check pending checklists using the calculated status from API
            const checklists = await getChecklists(venueId)
            const hasPending = checklists.some(c => c.status === 'pending')
            setHasPendingChecklists(hasPending)

            // 2. Check pending inventory (due schedules) from API
            const dueSchedules = await getDueSchedules(venueId)
            setHasPendingInventory(dueSchedules.length > 0)

        } catch (err) {
            console.error('Error checking pending tasks:', err)
        } finally {
            setLoading(false)
        }
    }, [selectedVenueId])

    useEffect(() => {
        checkPendingTasks()
        
        // Refresh every 5 minutes
        const interval = setInterval(checkPendingTasks, 5 * 60 * 1000)
        return () => clearInterval(interval)
    }, [checkPendingTasks])

    return { hasPendingChecklists, hasPendingInventory, loading }
}
