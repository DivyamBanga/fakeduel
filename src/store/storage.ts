import { createJSONStorage, type StateStorage } from 'zustand/middleware'
import { clearCacheStorage } from '@/lib/cache'

/** localStorage wrapper that never throws: on quota errors it evicts cached API payloads and retries. */
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value)
    } catch {
      try {
        clearCacheStorage()
        localStorage.setItem(name, value)
      } catch {
        /* give up silently; in-memory state still works */
      }
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name)
    } catch {
      /* ignore */
    }
  },
}

export const jsonStorage = () => createJSONStorage(() => safeStorage)
