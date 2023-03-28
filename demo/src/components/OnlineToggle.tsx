import React from 'react'
import { Toggle } from './Toggle'

export const OnlineToggle = ({
  isOnline = false,
  disabled = false,
  onChange = () => {},
}: OnlineToggleProps) => (
  <>
    <Toggle //
      className="OnlineToggle top-1"
      title={isOnline ? 'online' : 'offline'}
      on={isOnline}
      disabled={disabled}
      onClick={() => onChange(!isOnline)}
    />
    <svg
      className={`ml-1 inline-block transition-all ${isOnline ? 'fill-gray-500' : 'fill-gray-100'}`}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="16px"
      height="16px"
    >
      <path d="M 12 5 C 7.858 5 4.1075781 6.6785781 1.3925781 9.3925781 L 3.3359375 11.335938 C 5.6389375 9.2699375 8.67 8 12 8 C 15.33 8 18.362062 9.2689375 20.664062 11.335938 L 22.605469 9.3945312 C 19.891469 6.6795313 16.142 5 12 5 z M 12 10 C 9.221 10 6.6870469 11.043047 4.7480469 12.748047 L 6.8691406 14.869141 C 8.2601406 13.704141 10.049 13 12 13 C 13.951 13 15.740859 13.703141 17.130859 14.869141 L 19.25 12.75 C 17.312 11.044 14.779 10 12 10 z M 12 15 C 10.6 15 9.3149688 15.486969 8.2929688 16.292969 L 12 20 L 15.707031 16.292969 C 14.685031 15.486969 13.4 15 12 15 z" />
    </svg>
  </>
)

interface OnlineToggleProps {
  isOnline?: boolean
  disabled?: boolean
  onChange?: (value: boolean) => void
}
