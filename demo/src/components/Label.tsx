import React from 'react'

export const Label = ({ children, ...props }: { children: React.ReactNode }) => (
  <label className="text-sm" {...props}>
    {children}
  </label>
)
