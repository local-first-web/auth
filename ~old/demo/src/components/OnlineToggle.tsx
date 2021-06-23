import { Toggle } from './Toggle'

export const OnlineToggle = ({
  isOnline = false,
  disabled = false,
  onChange = () => {},
}: OnlineToggleProps) => (
  <Toggle //
    className="OnlineToggle"
    title={isOnline ? 'online' : 'offline'}
    on={isOnline}
    disabled={disabled}
    onClick={() => onChange(!isOnline)}
  />
)

interface OnlineToggleProps {
  isOnline?: boolean
  disabled?: boolean
  onChange?: (value: boolean) => void
}
