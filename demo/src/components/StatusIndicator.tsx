import React from 'react'

export const StatusIndicator: React.FC<{ status: string }> = ({ status = '' }) => {
  const statusIndicatorCx = () => {
    status = status.split(':')[0]
    switch (status) {
      case 'connecting':
        return 'border-t border-r border-b border-gray-300 animate-spin-fast'
      case 'connected':
        return 'bg-green-500'
      case 'synchronizing':
        return 'border-t border-r border-b border-green-500 animate-spin-fast'
      case 'idle':
      case 'disconnected':
      default:
        return 'bg-gray-300'
    }
  }
  return <span className={`${statusIndicatorCx()} h-3 w-3 rounded-full `} />
}
