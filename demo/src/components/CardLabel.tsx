import React from 'react'

export const CardLabel: React.FC<CardLabelProps> = ({ children }) => (
  <h2 className="CardLabel text-xs tracking-widest text-gray-400 uppercase">{children}</h2>
)
interface CardLabelProps {}
