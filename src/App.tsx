import { useEffect } from 'react'
import { GameScreen } from './components/GameScreen'
import { SessionSetup } from './components/SessionSetup'
import { useSession, useStore } from './store'

export default function App() {
  const hydrated = useStore((s) => s.hydrated)
  const hydrate = useStore((s) => s.hydrate)
  const session = useSession()

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  // Rendering setup before storage has been read would flash the new-session
  // screen over an in-progress game on every reload.
  if (!hydrated) return null

  return session ? <GameScreen session={session} /> : <SessionSetup />
}
