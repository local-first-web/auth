import React, { ReactNode } from 'react'
import Catch from './Catch'

type Props = {
  children: ReactNode
}

export const ErrorBoundary = Catch(function ErrorBoundary(props: Props, error?: Error) {
  if (error) {
    return (
      <div className="ErrorBoundary">
        <h2>An error has occured</h2>
        <h4>{error.message}</h4>
      </div>
    )
  } else {
    return <>{props.children}</>
  }
})
