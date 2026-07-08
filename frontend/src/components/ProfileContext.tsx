'use client'

import React, { createContext, useContext } from 'react'
import { type Profile } from '@/lib/api'

const ProfileContext = createContext<Profile | null>(null)

export function ProfileProvider({ children, value }: { children: React.ReactNode; value: Profile | null }) {
  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const context = useContext(ProfileContext)
  if (context === null) {
    throw new Error('useProfile must be used within a ProfileProvider')
  }
  return context
}
