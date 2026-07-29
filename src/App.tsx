import { useEffect, useState } from 'react'
import { GameScreen } from './components/GameScreen'
import { HomeScreen } from './components/HomeScreen'
import { SessionSetup } from './components/SessionSetup'
import { Settings } from './components/Settings'
import { useSession, useStore } from './store'

export default function App() {
  const hydrated = useStore((s) => s.hydrated)
  const hydrate = useStore((s) => s.hydrate)
  const session = useSession()
  // Which no-session screen to show: the games list, the new-game form, or settings.
  const [view, setView] = useState<'home' | 'new' | 'settings'>('home')

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  // Once a game is created/opened, drop back to home so a later Exit lands on the
  // games list rather than reopening the new-game form.
  useEffect(() => {
    if (session) setView('home')
  }, [session])

  // Rendering a screen before storage has been read would flash it over an
  // in-progress game on every reload.
  if (!hydrated) return null

  // A current session always wins, so a reload mid-game resumes straight into it.
  if (session) return <GameScreen session={session} />

  if (view === 'new') return <SessionSetup onCancel={() => setView('home')} />
  if (view === 'settings') return <Settings onClose={() => setView('home')} />
  return <HomeScreen onNewGame={() => setView('new')} onOpenSettings={() => setView('settings')} />
}
