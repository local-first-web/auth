import React from 'react'

type ErrorHandler = (error: Error, info: React.ErrorInfo) => void
type ErrorHandlingComponent<Props> = (props: Props, error?: Error) => React.ReactNode

type ErrorState = { error?: Error }

// from http://gist.github.com/andywer/800f3f25ce3698e8f8b5f1e79fed5c9c

export default function Catch<Props extends {}>(
  component: ErrorHandlingComponent<Props>,
  errorHandler?: ErrorHandler
): React.ComponentType<Props> {
  return class extends React.Component<Props, ErrorState> {
    state: ErrorState = {
      error: undefined,
    }

    static getDerivedStateFromError(error: Error) {
      return { error }
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
      if (errorHandler) {
        errorHandler(error, info)
      }
    }

    render() {
      return component(this.props, this.state.error)
    }
  }
}
