import { useEffect, useRef } from 'react'
import { AppStateProvider } from './state'
import { useAppState } from './useAppState'
import type { AppRoute } from './src/assets/contracts'
import Dashboard from './Dashboard'
import { PdfUploadPage } from './src/features/import/PdfUploadPage'
import { SavingsPage } from './src/features/journey/SavingsPage'
import { MoneyPlanPage } from './src/features/journey/MoneyPlanPage'
import './App.css'

const steps: { route: AppRoute; label: string }[] = [
  { route: 'import', label: 'Upload statement' },
  { route: 'dashboard', label: 'Your breakdown' },
  { route: 'opportunities', label: 'Find savings' },
  { route: 'planning', label: 'Your money plan' },
]

function AppShell() {
  const { state, dispatch } = useAppState()
  const main = useRef<HTMLElement>(null)
  const current = steps.findIndex(step => step.route === state.route)
  const hasData = state.transactions.length > 0
  useEffect(() => {
    main.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [state.route])

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="app-header">
      <div className="header-inner">
        <button className="brand" onClick={() => dispatch({ type: 'navigation/go', route: 'import' })} aria-label="Racks home">racks<span className="brand-dot">.</span></button>
        <span className="header-purpose">Your student money</span>
        <span className="header-private"><span aria-hidden="true">◈</span> Your data stays on this device</span>
      </div>
      <nav className="journey-nav" aria-label="Your money journey"><ol>
        {steps.map((step, index) => <li key={step.route}><button className={'journey-step' + (index === current ? ' active' : '') + (index < current ? ' visited' : '')} disabled={index > 0 && !hasData} aria-current={index === current ? 'step' : undefined} onClick={() => dispatch({ type: 'navigation/go', route: step.route })}><span className="step-number">{index < current ? '✓' : `0${index + 1}`}</span><span>{step.label}</span>{index < 3 && <span className="step-arrow" aria-hidden="true">›</span>}</button></li>)}
      </ol></nav>
    </header>
    <main id="main-content" className="main-area" tabIndex={-1} ref={main}>
      <div className="page-wrap"><div className="page-transition" key={state.route}>
        {state.route === 'import' ? <PdfUploadPage /> : state.route === 'dashboard' ? <Dashboard /> : state.route === 'opportunities' ? <SavingsPage /> : <MoneyPlanPage />}
      </div></div>
    </main>
    <footer className="app-footer"><span>racks<span className="brand-dot">.</span></span><small>Session only · Refreshing clears your statements</small></footer>
  </div>
}

export default function App() {
  return <AppStateProvider><AppShell /></AppStateProvider>
}
