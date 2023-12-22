import React, { type ReactNode } from 'react'
import Catch from './Catch.js'

type Props = {
  children: ReactNode
}

// eslint-disable-next-line new-cap
export const ErrorBoundary = Catch(function (props: Props, error?: Error) {
  if (error) {
    return (
      <div className="ErrorBoundary">
        <h2>An error has occured</h2>
        <h4>{error.message}</h4>
      </div>
    )
  }

  return <>{props.children}</>
})
