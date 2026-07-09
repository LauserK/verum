'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { type Profile, type VenueInfo } from '@/lib/api'
import { useProfile } from '@/hooks/useProfile'

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
  const { data: profile, isLoading: isProfileLoading } = useProfile()
  const [activeOrgIdState, setActiveOrgIdStateState] = useState<string | null>(null)
  const [selectedVenueIdState, setSelectedVenueIdStateState] = useState<string | null>(null)

  // Load initial values from localStorage on mount (client-side only)
  useEffect(() => {
    const savedOrgId = localStorage.getItem('activeOrgId')
    const savedVenueId = localStorage.getItem('selectedVenueId')
    if (savedOrgId) setActiveOrgIdStateState(savedOrgId)
    if (savedVenueId) setSelectedVenueIdStateState(savedVenueId)
  }, [])

  // Derive all other values during render
  const orgs = profile?.organizations || []
  const orgsCount = orgs.length
  const isMultiOrg = orgsCount > 1

  // Resolve the active organization
  let activeOrg = orgs.find(o => o.id === activeOrgIdState)
  if (!activeOrg && orgs.length > 0) {
    // Fallback to first org or the saved org in localStorage if valid
    const savedOrgId = typeof window !== 'undefined' ? localStorage.getItem('activeOrgId') : null
    activeOrg = orgs.find(o => o.id === savedOrgId) || orgs[0]
  }

  const activeOrgId = activeOrg?.id || null
  const activeOrgName = activeOrg?.name || null
  const availableVenues = activeOrg?.venues || []

  // Resolve and validate the selected venue
  let selectedVenue = availableVenues.find(v => v.id === selectedVenueIdState)
  if (!selectedVenue && availableVenues.length > 0) {
    const savedVenueId = typeof window !== 'undefined' ? localStorage.getItem('selectedVenueId') : null
    selectedVenue = availableVenues.find(v => v.id === savedVenueId) || availableVenues[0]
  }

  const selectedVenueId = selectedVenue?.id || null
  const selectedVenueName = selectedVenue?.name || null

  // Keep localStorage in sync when selected IDs change
  useEffect(() => {
    if (activeOrgId) {
      localStorage.setItem('activeOrgId', activeOrgId)
    }
  }, [activeOrgId])

  useEffect(() => {
    if (selectedVenueId) {
      localStorage.setItem('selectedVenueId', selectedVenueId)
    }
  }, [selectedVenueId])

  const setActiveOrgId = useCallback((id: string) => {
    setActiveOrgIdStateState(id)
    localStorage.setItem('activeOrgId', id)
    setSelectedVenueIdStateState(null) // Reset venue when changing org
    localStorage.removeItem('selectedVenueId')
  }, [])

  const setSelectedVenueId = useCallback((id: string) => {
    setSelectedVenueIdStateState(id)
    localStorage.setItem('selectedVenueId', id)
  }, [])

  const isLoading = isProfileLoading || (profile ? false : true)

  return (
    <VenueContext.Provider value={{ 
      activeOrgId,
      activeOrgName,
      setActiveOrgId,
      selectedVenueId, 
      selectedVenueName, 
      availableVenues, 
      setSelectedVenueId, 
      isLoading,
      orgsCount,
      isMultiOrg
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
