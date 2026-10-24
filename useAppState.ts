import { useContext } from 'react'
import { StateContext } from './stateContext'

export function useAppState() {
  const store = useContext(StateContext)
  if (!store) throw new Error('useAppState must be used inside AppStateProvider')
  return store
}