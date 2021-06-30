import React from 'react'
const noOp = () => {}

export const Toggle = ({
  title,
  on,
  disabled = false,
  onClick = noOp,
  className = '',
}: ToggleProps) => {
  return (
    <span
      role="checkbox"
      aria-checked={on}
      aria-disabled={disabled}
      className={`${className}
        Toggle
        group relative inline-flex items-center justify-center 
        ${disabled ? 'opacity-50' : 'opacity-100'}
        flex-shrink-0 h-4 w-8 cursor-pointer focus:outline-none`}
      title={title}
      onClick={disabled ? noOp : onClick}
    >
      {/* Slot */}
      <span
        aria-hidden="true"
        className={`absolute h-3 w-full mx-auto 
          rounded-full ${on ? 'bg-green-500' : 'bg-gray-300'} 
          transition-colors ease-in-out duration-200`}
      ></span>

      {/* Knob */}
      <span
        aria-hidden="true"
        className={`absolute left-0 inline-block h-4 w-4 
          transform ${on ? 'translate-x-4' : ''} 
          border border-gray-400 rounded-full bg-white shadow
          group-focus:shadow-outline group-focus:border-blue-300
          transition-transform ease-in-out duration-200`}
      ></span>
    </span>
  )
}

interface ToggleProps {
  title: string
  on: boolean
  disabled?: boolean
  onClick?: () => void
  className?: string
}
