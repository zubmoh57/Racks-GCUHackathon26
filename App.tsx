import { useState } from 'react'
import { AppStateProvider } from './state'
import { useAppState } from './useAppState'
import type { AppRoute } from './src/assets/contracts'
import Dashboard from './Dashboard'
import { PdfUploadPage } from './src/features/import/PdfUploadPage'
import './App.css'

const navigation: { route: AppRoute; icon: string; label: string }[] = [
  { route: 'dashboard', icon: '◫', label: 'Overview' },
  { route: 'import', icon: '↥', label: 'Transactions' },
  { route: 'opportunities', icon: '✳', label: 'Ways to save' },
  { route: 'planning', icon: '◎', label: 'Budget & goals' },
]

function ModulePage({ route }: { route: Exclude<AppRoute, 'dashboard' | 'import'> }) {
  const { dispatch } = useAppState()
  const detail =
    route === 'opportunities'
      ? { owner: 'AVI · PRACTICAL SAVINGS', title: 'Small ideas that add up.', copy: 'Explore sourced offers and choose actions that fit your life. Your favourite treats stay part of your plan.', icon: '✳' }
      : { owner: 'CHIRAG · BUDGET & GOALS', title: 'Make a plan that feels doable.', copy: 'Set a budget, build a savings goal, and see optional illustrations for the choices you make.', icon: '◎' }

  return (
    <section className="module-page">
      <div className="module-heading">
        <span className="module-page-mark">{detail.icon}</span>
        <div>
          <p className="eyebrow">{detail.owner}</p>
          <h1>{detail.title}</h1>
          <p className="module-intro">{detail.copy}</p>
        </div>
      </div>
      <div className="handoff-card">
        <span className="handoff-icon">✦</span>
        <div>
          <b>Team feature slot</b>
          <p>This section is part of the shared Morrow app shell. Its feature can connect here without changing the dashboard or navigation.</p>
        </div>
      </div>
      <button className="primary-quiet" onClick={() => dispatch({ type: 'navigation/go', route: 'dashboard' })}>
        Back to overview <span>→</span>
      </button>
    </section>
  )
}

function AppShell() {
  const { state, dispatch } = useAppState()
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.localStorage.getItem('morrow-theme') === 'dark'
    } catch {
      return false
    }
  })

  function toggleTheme() {
    const nextTheme = !darkMode
    setDarkMode(nextTheme)
    try {
      window.localStorage.setItem('morrow-theme', nextTheme ? 'dark' : 'light')
    } catch {
      // Keep the in-session toggle available if browser storage is disabled.
    }
  }

  return (
    <div className={'app-shell' + (darkMode ? ' dark-mode' : '')}>
      <header className="app-header">
        <div className="header-inner">
          <button className="brand" onClick={() => dispatch({ type: 'navigation/go', route: 'dashboard' })} aria-label="Morrow home">
            <span className="brand-symbol">m</span>
            <span>morrow</span>
          </button>
          <nav className="primary-nav" aria-label="Main navigation">
            {navigation.map(({ route, icon, label }) => (
              <button
                key={route}
                className={'nav-link' + (state.route === route ? ' active' : '')}
                aria-current={state.route === route ? 'page' : undefined}
                onClick={() => dispatch({ type: 'navigation/go', route })}
              >
                <span className="nav-icon" aria-hidden="true">{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="header-actions">
            <button className="theme-toggle" onClick={toggleTheme} aria-pressed={darkMode} aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
              <span aria-hidden="true">{darkMode ? '☀' : '◐'}</span>
              <span className="theme-toggle-label">{darkMode ? 'Light mode' : 'Dark mode'}</span>
            </button>
            <span className="privacy-pill"><i />Private preview</span>
            <span className="avatar" aria-label="Alex Morgan">AM</span>
          </div>
        </div>
      </header>
      <main className="main-area">
        <div className="page-wrap">
          <div className="page-transition" key={state.route}>
            {state.route === 'dashboard' ? <Dashboard /> : state.route === 'import' ? <PdfUploadPage /> : <ModulePage route={state.route} />}
          </div>
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AppStateProvider>
      <AppShell />
    </AppStateProvider>
  )
}
