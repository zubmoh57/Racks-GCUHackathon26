import { useReducer, type ReactNode } from 'react'
import type { SharedAction, SharedState } from './src/assets/contracts'
import { StateContext } from './stateContext'

const initialState: SharedState = {
  route: 'import', transactions: [], imports: [], coverage: null, isDemoData: false,
  period: 'month', periodOffset: 0, selectedDate: null, budget: null, goal: null, opportunities: [], protections: [], selectedActions: [],
  moneyPlan: { incomePence: null, essentialsPence: null, fundingPence: 0, freedom: 50, cushion: 50, future: 0, investmentReady: false, goalName: 'Emergency fund', goalTargetPence: 50000, confirmed: false },
}
function reducer(state: SharedState, action: SharedAction): SharedState {
  switch (action.type) {
    case 'navigation/go': return { ...state, route: action.route }
    case 'ledger/replace': return { ...state, transactions: action.transactions, imports: action.imports ?? state.imports, coverage: action.coverage, isDemoData: false, selectedDate: null, periodOffset: 0, moneyPlan: { ...state.moneyPlan, confirmed: false } }
    case 'dashboard/period': return { ...state, period: action.period, periodOffset: 0, selectedDate: null }
    case 'dashboard/offset': return { ...state, periodOffset: action.offset, selectedDate: null }
    case 'dashboard/select-date': return { ...state, selectedDate: action.date }
    case 'planning/budget': return { ...state, budget: action.budget }
    case 'planning/goal': return { ...state, goal: action.goal }
    case 'opportunities/replace': return { ...state, opportunities: action.opportunities }
    case 'protections/replace': return { ...state, protections: action.protections }
    case 'actions/replace': return { ...state, selectedActions: action.selectedActions }
    case 'planning/preferences': return Object.entries(action.patch).every(([key, value]) => state.moneyPlan[key as keyof typeof state.moneyPlan] === value) ? state : { ...state, moneyPlan: { ...state.moneyPlan, ...action.patch, confirmed: false } }
    case 'planning/confirm': return { ...state, moneyPlan: { ...state.moneyPlan, incomePence: action.incomePence, essentialsPence: action.essentialsPence, confirmed: true } }
    default: return state
  }
}
export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  return <StateContext.Provider value={{ state, dispatch }}>{children}</StateContext.Provider>
}


