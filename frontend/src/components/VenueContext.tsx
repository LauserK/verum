'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getProfile, type Profile, type VenueInfo } from '@/lib/api'

interface VenueContextType {
  activeOrgId: string | null
  activeOrgName: string | null
  setActiveOrgId: (id: string) => void
  selectedVenueId: string | null
  selectedVenueName: string | null
  availableVenues: VenueInfo[]
  setSelectedVenueId: (id: string) => void
  isLoading: boolean
  orgsCount: number
  isMultiOrg: boolean
}

const VenueContext = createContext<VenueContextType | undefined>(undefined)

export function VenueProvider({ children }: { children: React.ReactNode }) {
  const [activeOrgIdState, setActiveOrgIdState] = useState<string | null>(null)
  const [activeOrgNameState, setActiveOrgNameState] = useState<string | null>(null)
  const [selectedVenueIdState, setSelectedVenueIdState] = useState<string | null>(null)
  const [availableVenues, setAvailableVenues] = useState<VenueInfo[]>([])
  const [orgsCount, setOrgsCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      try {
        const profile = await getProfile()
        if (profile && profile.organizations && profile.organizations.length > 0) {
          setOrgsCount(profile.organizations.length)
          
          // 1. Determine which organization to use
          const savedOrgId = localStorage.getItem('activeOrgId')
          const currentOrgId = activeOrgIdState || savedOrgId
          const validOrg = profile.organizations.find(o => o.id === currentOrgId) || profile.organizations[0]
          
          if (validOrg.id !== activeOrgIdState) {
            setActiveOrgIdState(validOrg.id)
          }
          if (validOrg.name !== activeOrgNameState) {
            setActiveOrgNameState(validOrg.name)
          }
          if (validOrg.id !== savedOrgId) {
            localStorage.setItem('activeOrgId', validOrg.id)
          }

          const venues = validOrg.venues || []
          setAvailableVenues(venues)
          
          // 2. Initialize or validate selectedVenueId
          const savedVenueId = localStorage.getItem('selectedVenueId')
          const currentVenueId = selectedVenueIdState || savedVenueId
          
          // Ensure the selected venue actually belongs to the active organization
          const validVenue = venues.find(v => v.id === currentVenueId) || (venues.length > 0 ? venues[0] : null)
          
          if (validVenue) {
            if (validVenue.id !== selectedVenueIdState) {
              setSelectedVenueIdState(validVenue.id)
              localStorage.setItem('selectedVenueId', validVenue.id)
            }
          } else {
            // No venues in this org, or current selection is invalid for this org
            if (selectedVenueIdState !== null) {
              setSelectedVenueIdState(null)
              localStorage.removeItem('selectedVenueId')
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

  const setActiveOrgId = useCallback((id: string) => {
    setActiveOrgIdState(id)
    localStorage.setItem('activeOrgId', id)
    // Clear selected venue so it gets recalculated for the new org in the useEffect
    setSelectedVenueIdState(null)
    localStorage.removeItem('selectedVenueId')
  }, [])

  const setSelectedVenueId = useCallback((id: string) => {
    setSelectedVenueIdState(id)
    localStorage.setItem('selectedVenueId', id)
  }, [])

  const selectedVenueName = availableVenues.find(v => v.id === selectedVenueIdState)?.name || null

  return (
    <VenueContext.Provider value={{ 
      activeOrgId: activeOrgIdState,
      activeOrgName: activeOrgNameState,
      setActiveOrgId,
      selectedVenueId: selectedVenueIdState, 
      selectedVenueName, 
      availableVenues, 
      setSelectedVenueId, 
      isLoading,
      orgsCount,
      isMultiOrg: orgsCount > 1
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
