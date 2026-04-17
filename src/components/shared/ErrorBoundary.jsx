import React from 'react'
import { reportClientError } from '../../utils/clientErrorReporter'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    reportClientError(error, info?.componentStack || 'ErrorBoundary')
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          padding: '32px',
          textAlign: 'center',
          backgroundColor: '#f9f9f9',
          fontFamily: 'Roboto, sans-serif'
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px'
          }}>⚠️</div>
          <div style={{
            fontSize: '20px',
            fontWeight: '700',
            color: '#021428',
            marginBottom: '8px',
            fontFamily: 'Montserrat, sans-serif'
          }}>
            Something went wrong
          </div>
          <div style={{
            fontSize: '14px',
            color: '#666',
            marginBottom: '24px',
            maxWidth: '300px',
            lineHeight: '1.5'
          }}>
            We've been notified and are looking into it. Please refresh the page to try again.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: '#CC0000',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              fontFamily: 'Montserrat, sans-serif'
            }}
          >
            Refresh Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
