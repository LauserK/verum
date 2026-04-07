'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { getProfile, type Profile, type VenueInfo } from '@/lib/api'

interface VenueContextType {
  activeOrgId: string | null
  setActiveOrgId: (id: string) => void
  selectedVenueId: string | null
  selectedVenueName: string | null
  availableVenues: VenueInfo[]
  setSelectedVenueId: (id: string) => void
  isLoading: boolean
}

const VenueContext = createContext<VenueContextType | undefined>(undefined)

export function VenueProvider({ children }: { children: React.ReactNode }) {
  const [activeOrgIdState, setActiveOrgIdState] = useState<string | null>(null)
  const [selectedVenueIdState, setSelectedVenueIdState] = useState<string | null>(null)
  const [availableVenues, setAvailableVenues] = useState<VenueInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      try {
        const profile = await getProfile()
        if (profile && profile.organizations && profile.organizations.length > 0) {
          // 1. Determine which organization to use
          const savedOrgId = localStorage.getItem('activeOrgId')
          const currentOrgId = activeOrgIdState || savedOrgId
          const validOrg = profile.organizations.find(o => o.id === currentOrgId) || profile.organizations[0]
          
          if (validOrg.id !== activeOrgIdState) {
            setActiveOrgIdState(validOrg.id)
          }
          if (validOrg.id !== savedOrgId) {
            localStorage.setItem('activeOrgId', validOrg.id)
          }

          const venues = validOrg.venues || []
          setAvailableVenues(venues)
          
          // 2. Initialize or validate selectedVenueId
          const savedVenueId = localStorage.getItem('selectedVenueId')
          const currentVenueId = selectedVenueIdState || savedVenueId
          const validVenue = venues.find(v => v.id === currentVenueId) || venues[0]
          
          if (validVenue) {
            if (validVenue.id !== selectedVenueIdState) {
              setSelectedVenueIdState(validVenue.id)
            }
            if (validVenue.id !== savedVenueId) {
              localStorage.setItem('selectedVenueId', validVenue.id)
            }
          }
        }
      } catch (err) {
        console.error("Failed to load venues for context", err)
      } finally {
        setIsLoading(false)
      }
    }
    loadProfile()
  }, [activeOrgIdState, selectedVenueIdState])

  const setActiveOrgId = (id: string) => {
    setActiveOrgIdState(id)
    localStorage.setItem('activeOrgId', id)
    // When changing org, we should probably reset venue, but this might be handled by the effect or UI
  }

  const setSelectedVenueId = (id: string) => {
    setSelectedVenueIdState(id)
    localStorage.setItem('selectedVenueId', id)
  }

  const selectedVenueName = availableVenues.find(v => v.id === selectedVenueIdState)?.name || null

  return (
    <VenueContext.Provider value={{ 
      activeOrgId: activeOrgIdState,
      setActiveOrgId,
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
