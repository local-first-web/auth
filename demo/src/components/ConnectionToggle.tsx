import React from 'react'
import { Toggle } from './Toggle'

export const ConnectionToggle = ({
  isConnected = false,
  disabled = false,
  onChange = () => {},
}: ConnectionToggleProps) => (
  <Toggle //
    on={isConnected}
    disabled={disabled}
    onClick={() => onChange(!isConnected)}
  />
)

interface ConnectionToggleProps {
  isConnected?: boolean
  disabled?: boolean
  onChange?: (value: boolean) => void
}
