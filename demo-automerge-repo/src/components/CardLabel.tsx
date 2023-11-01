import React, { type ReactNode } from 'react'

export const CardLabel = ({ children }: CardLabelProps) => (
  <h2 className="CardLabel text-xs tracking-widest text-gray-400 uppercase">
    {children}
  </h2>
)
type CardLabelProps = {
  children: ReactNode
}
