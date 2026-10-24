import { useReducer, type ReactNode } from 'react'
import type { SharedAction, SharedState } from './src/assets/contracts'
import { StateContext } from './stateContext'
import { demoCoverage, demoTransactions } from './src/assets/demoData'

const initialState: SharedState = {
  route: 'dashboard', transactions: demoTransactions, imports: [], coverage: demoCoverage, isDemoData: true,
  period: 'week', periodOffset: 0, selectedDate: null, budget: null, goal: null, opportunities: [], protections: [], selectedActions: [],
}
function reducer(state: SharedState, action: SharedAction): SharedState {
  switch (action.type) {
    case 'navigation/go': return { ...state, route: action.route }
    case 'ledger/replace': return { ...state, transactions: action.transactions, imports: action.imports ?? state.imports, coverage: action.coverage, isDemoData: false, selectedDate: null, periodOffset: 0 }
    case 'dashboard/period': return { ...state, period: action.period, periodOffset: 0, selectedDate: null }
    case 'dashboard/offset': return { ...state, periodOffset: action.offset, selectedDate: null }
    case 'dashboard/select-date': return { ...state, selectedDate: action.date }
    case 'planning/budget': return { ...state, budget: action.budget }
    case 'planning/goal': return { ...state, goal: action.goal }
    case 'opportunities/replace': return { ...state, opportunities: action.opportunities }
    case 'protections/replace': return { ...state, protections: action.protections }
    case 'actions/replace': return { ...state, selectedActions: action.selectedActions }
    default: return state
  }
}
export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  return <StateContext.Provider value={{ state, dispatch }}>{children}</StateContext.Provider>
}


