'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

export type TimezoneOption = 'locale' | 'IST' | 'Canada' | 'UTC'

interface TimezoneContextType {
  timezone: TimezoneOption
  setTimezone: (tz: TimezoneOption) => void
}

const TimezoneContext = createContext<TimezoneContextType | undefined>(undefined)

export function TimezoneProvider({ children }: { children: React.ReactNode }) {
  const [timezone, setTimezoneState] = useState<TimezoneOption>('locale')

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('global-timezone')
    if (saved && ['locale', 'IST', 'Canada', 'UTC'].includes(saved)) {
      setTimezoneState(saved as TimezoneOption)
    }
  }, [])

  const setTimezone = (tz: TimezoneOption) => {
    setTimezoneState(tz)
    localStorage.setItem('global-timezone', tz)
  }

  return (
    <TimezoneContext.Provider value={{ timezone, setTimezone }}>
      {children}
    </TimezoneContext.Provider>
  )
}

export function useTimezone() {
  const context = useContext(TimezoneContext)
  if (context === undefined) {
    throw new Error('useTimezone must be used within a TimezoneProvider')
  }
  return context
}
