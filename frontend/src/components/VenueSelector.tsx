'use client'

import React from 'react'
import { useVenue } from '@/components/VenueContext'

export function VenueSelector() {
  const { availableVenues, selectedVenueId, setSelectedVenueId } = useVenue()

  if (availableVenues.length <= 1) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <select 
        value={selectedVenueId || ''} 
        onChange={(e) => setSelectedVenueId(e.target.value)}
        className="text-sm bg-surface-raised border border-border rounded-md px-2 py-1 focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
        aria-label="Select Venue"
      >
        {availableVenues.map(v => (
          <option key={v.id} value={v.id}>{v.name}</option>
        ))}
      </select>
    </div>
  )
}
