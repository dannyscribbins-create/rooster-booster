import React from 'react'
import { reportClientError } from '../../utils/clientErrorReporter'
import { fontVar } from '../../constants/elevationTheme';

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
          fontFamily: fontVar('body')
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px'
          }}>⚠️</div>
          <div style={{
            fontSize: '20px',
            fontWeight: '700',
            // ⚠ THE EXCEPTION IS STILL VALID AND THE VALUE WAS NOT. This read
            // `#021428` under the note "intentional exception — ErrorBoundary
            // renders outside React tree, cannot use R tokens". The REASON is
            // sound: this renders when the tree has crashed, possibly outside
            // ThemeProvider, so `var(--rm-*)` would take its fallback anyway and
            // a literal is honest. ⚠ BUT "USE A LITERAL" NEVER MEANT "USE THAT
            // CONTRACTOR'S LITERAL" — #021428 is an Accent-family navy, and the
            // exception was granted for the MECHANISM, not for the value.
            // Nobody re-ran the choice when the palette was retired, which is
            // the shape this repo records: a rule applied once to a surface does
            // not stay applied when the surface moves.
            // #1C2D4D is the platform's dark neutral.
            color: '#1C2D4D',
            marginBottom: '8px',
            fontFamily: fontVar('heading')
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
              // ⚠ THIS WAS `#CC0000` — ACCENT ROOFING'S RED, RETIRED IN ABR
              // PHASE 5, LIVE ON THE CRASH SCREEN EVERY CONTRACTOR SEES. Same
              // exception, same correction: the literal is right and the value
              // was one tenant's brand. #DC2626 is what STATUS_LIGHT.danger
              // mounts, so this button now matches every other danger fill in
              // the product instead of a company most contractors never heard of.
              // ⚠ IT SURVIVED ELEVEN COLOUR PHASES BECAUSE EVERY SWEEP THAT
              // REPORTED "zero retired tones" WAS SCOPED TO THE REFERRER TREE,
              // and this file is in shared/. A true statement whose scope was
              // never stated — the same shape as the focus ring in App.jsx.
              backgroundColor: '#DC2626',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              fontFamily: fontVar('heading')
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
