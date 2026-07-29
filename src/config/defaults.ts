import type { GameConfig, ScriptConfig } from '../types'
import avalonGame from './game.avalon.json'
import botcGame from './game.botc.json'
import avalonBase from './script.avalon.json'
import troubleBrewing from './script.trouble-brewing.json'

// The games/scripts the app *ships* with. They are no longer privileged built-ins:
// they are seed content, copied once into the config store on first run (see
// custom.ts `seedDefaults`) and thereafter ordinary, editable, deletable entries.
// The JSON is still imported at build time so "Restore defaults" has a source to
// re-seed from. JSON imports widen literals to `string`, so the shapes are asserted.
export const DEFAULT_GAMES: GameConfig[] = [
  botcGame as unknown as GameConfig,
  avalonGame as unknown as GameConfig,
]

export const DEFAULT_SCRIPTS: ScriptConfig[] = [
  troubleBrewing as unknown as ScriptConfig,
  avalonBase as unknown as ScriptConfig,
]

// The session-setup picker opens on these when they exist; both are just the first
// shipped game/script, and callers fall back to whatever configs remain if deleted.
export const DEFAULT_GAME_ID = 'botc'
export const DEFAULT_SCRIPT_ID = 'trouble-brewing'
