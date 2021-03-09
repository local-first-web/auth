import React from 'react'
import { Toggle } from './Toggle'

export const ConnectionToggle: React.FC<ConnectionToggleProps> = ({
  isConnected = false,
  disabled = false,
  onChange = () => {},
}) => (
  <Toggle //
    on={isConnected}
    disabled={disabled}
    onClick={() => onChange(!isConnected)}
  ></Toggle>
)

interface ConnectionToggleProps {
  isConnected?: boolean
  disabled?: boolean
  onChange?: (value: boolean) => void
}
