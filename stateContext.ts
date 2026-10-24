import { createContext, type Dispatch } from 'react'
import type { SharedAction, SharedState } from './src/assets/contracts'

export type AppStateStore = {
  state: SharedState
  dispatch: Dispatch<SharedAction>
}

export const StateContext = createContext<AppStateStore | null>(null)