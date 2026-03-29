'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { getProfile, type Profile, type VenueInfo } from '@/lib/api'

interface VenueContextType {
  selectedVenueId: string | null
  selectedVenueName: string | null
  availableVenues: VenueInfo[]
  setSelectedVenueId: (id: string) => void
  isLoading: boolean
}

const VenueContext = createContext<VenueContextType | undefined>(undefined)

export function VenueProvider({ children }: { children: React.ReactNode }) {
  const [selectedVenueIdState, setSelectedVenueIdState] = useState<string | null>(null)
  const [availableVenues, setAvailableVenues] = useState<VenueInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      try {
        const profile = await getProfile()
        if (profile && profile.venues && profile.venues.length > 0) {
          setAvailableVenues(profile.venues)
          
          // Check local storage first
          const savedId = localStorage.getItem('selectedVenueId')
          const validSaved = profile.venues.find(v => v.id === savedId)
          
          if (validSaved) {
            setSelectedVenueIdState(validSaved.id)
          } else {
            // Default to first venue
            setSelectedVenueIdState(profile.venues[0].id)
            localStorage.setItem('selectedVenueId', profile.venues[0].id)
          }
        }
      } catch (err) {
        console.error("Failed to load venues for context", err)
      } finally {
        setIsLoading(false)
      }
    }
    loadProfile()
  }, [])

  const setSelectedVenueId = (id: string) => {
    setSelectedVenueIdState(id)
    localStorage.setItem('selectedVenueId', id)
    // Dispatch event so other components (like dashboard) know to refresh data
    window.dispatchEvent(new Event('venueChanged'))
  }

  const selectedVenueName = availableVenues.find(v => v.id === selectedVenueIdState)?.name || null

  return (
    <VenueContext.Provider value={{ 
      selectedVenueId: selectedVenueIdState, 
      selectedVenueName, 
      availableVenues, 
      setSelectedVenueId, 
      isLoading 
    }}>
      {children}
    </VenueContext.Provider>
  )
}

export function useVenue() {
  const context = useContext(VenueContext)
  if (context === undefined) {
    throw new Error('useVenue must be used within a VenueProvider')
  }
  return context
}
