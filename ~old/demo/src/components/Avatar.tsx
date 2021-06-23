import React from 'react'
import classNames from 'classnames'

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(function Avatar(props, ref) {
  const { size = 'md', className, children } = props
  const sizeStyles = {
    lg: 'w-12 h-12 text-2xl',
    md: 'w-10 h-10 text-lg',
    sm: 'w-8 h-8 text-md',
  }
  const baseStyle =
    'Avatar rounded-full border border-white bg-white bg-opacity-50 mr-3 flex items-center'
  const cls = classNames(baseStyle, sizeStyles[size], className)
  return (
    <div className={cls}>
      <div className="align-middle text-center w-full">{children}</div>
    </div>
  )
})
interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'lg' | 'md' | 'sm'
}
