import { useEffect, useState } from 'react'
import { GameScreen } from './components/GameScreen'
import { HomeScreen } from './components/HomeScreen'
import { SessionSetup } from './components/SessionSetup'
import { useSession, useStore } from './store'

export default function App() {
  const hydrated = useStore((s) => s.hydrated)
  const hydrate = useStore((s) => s.hydrate)
  const session = useSession()
  // Which no-session screen to show: the games list, or the new-game form.
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  // Once a game is created/opened, drop the creating flag so a later Exit lands
  // back on the games list rather than reopening the new-game form.
  useEffect(() => {
    if (session) setCreating(false)
  }, [session])

  // Rendering a screen before storage has been read would flash it over an
  // in-progress game on every reload.
  if (!hydrated) return null

  // A current session always wins, so a reload mid-game resumes straight into it.
  if (session) return <GameScreen session={session} />

  return creating ? (
    <SessionSetup onCancel={() => setCreating(false)} />
  ) : (
    <HomeScreen onNewGame={() => setCreating(true)} />
  )
}
