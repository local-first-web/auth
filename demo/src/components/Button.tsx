import React, { ReactNode } from 'react'

export const Button = ({
  className,
  children,
  onClick,
}: {
  className?: string
  children: ReactNode
  onClick?: () => void
}) => {
  return (
    <button
      className={`bg-blue-500 text-white py-1 px-3 text-sm rounded-md font-bold ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
