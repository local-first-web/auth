import React from 'react'

export const HideButton = ({ onClick }: HideButtonProps) => (
  <div className="HideButton opacity-0 group-hover:opacity-100">
    <button
      className="absolute top-0 right-0 w-4 h-4 m-2 leading-none opacity-75 rounded-full
        border border-white
        text-white text-xs
        hover:opacity-100 hover:bg-white hover:text-teal-500 
        focus:opacity-100 focus:outline-none focus:shadow-outline-neutral  "
      onClick={onClick}
      title="Power off and hide this device"
    >
      ✖︎
    </button>
  </div>
)
type HideButtonProps = {
  onClick: () => void
}
