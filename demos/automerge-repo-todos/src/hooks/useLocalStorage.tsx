import { useState, type Dispatch, type SetStateAction } from 'react'

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    const storedValue = window.localStorage.getItem(key)
    return storedValue ? (JSON.parse(storedValue) as T) : initialValue
  })

  const setValue = (arg: T | ((s: T) => T)) => {
    // Allow value to be a function (same API as useState)
    const newValue = arg instanceof Function ? arg(storedValue) : arg
    // Update value in memory
    setStoredValue(newValue)
    // Update value in local storage
    window.localStorage.setItem(key, JSON.stringify(newValue))
  }

  return [storedValue, setValue] as [T, Dispatch<SetStateAction<T>>]
}
