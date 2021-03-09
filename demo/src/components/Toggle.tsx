import React from 'react'

export const Toggle: React.FC<ToggleProps> = ({ on, disabled = false, onClick }: ToggleProps) => {
  const noOp = () => {}
  return (
    <span
      role="checkbox"
      aria-checked={on}
      aria-disabled={disabled}
      className={`Toggle
        group relative inline-flex items-center justify-center 
        opacity-${disabled ? 50 : 100}      
        flex-shrink-0 h-4 w-6 cursor-pointer focus:outline-none`}
      onClick={disabled ? noOp : onClick}
    >
      {/* Slot */}
      <span
        aria-hidden="true"
        className={`absolute h-2 w-full mx-auto 
          rounded-full bg-${on ? 'green-600' : 'gray-300'} 
          transition-colors ease-in-out duration-200`}
      ></span>

      {/* Knob */}
      <span
        aria-hidden="true"
        className={`absolute left-0 inline-block h-3 w-3 
          transform translate-x-${on ? 3 : 0} 
          border border-gray-400 rounded-full bg-white shadow
          group-focus:shadow-outline group-focus:border-blue-300
          transition-transform ease-in-out duration-200`}
      ></span>
    </span>
  )
}
interface ToggleProps {
  on: boolean
  disabled?: boolean
  onClick?: () => void
}
