import { useSettings, type Lang } from './settings'

// Lightweight i18n — no library. A flat key→string dictionary per language, a `t`
// lookup with `{param}` interpolation, and a `tOr` that falls back to a supplied
// string when a key is absent. UI *chrome* is translated here; config-authored text
// (game/role/team/phase names) is left as the config declares it. Relation labels are
// the one hybrid: the shipped default vocabulary is translated by id (below), while a
// game's own custom relations fall back to their authored label.

type Dict = Record<string, string>

const en: Dict = {
  // common
  'common.cancel': 'Cancel',
  'common.and': ' and ',
  'common.done': 'Done',
  'common.duplicate': 'Duplicate',
  'common.create': 'Create',
  'common.delete': 'Delete',
  'common.remove': 'Remove',
  'common.export': 'Export',
  'common.close': 'Close',
  'common.restoreDefaults': 'Restore default games',

  // home
  'home.title': 'Games',
  'home.newGame': '+ New game',
  'home.settings': 'Settings',
  'home.empty': 'No games yet. Start one to begin tracking.',
  'home.ongoing': 'ongoing',
  'home.finished': 'finished',
  'home.players': '{n} players',
  'home.today': 'Today',
  'home.yesterday': 'Yesterday',
  'home.export': 'Export…',
  'home.reopen': 'Reopen as ongoing',
  'home.markFinished': 'Mark finished',
  'home.deleteConfirm': "Delete this game? This can't be undone.",

  // setup
  'setup.title': 'New session',
  'setup.game': 'Game',
  'setup.importGame': '＋ Import a game',
  'setup.script': 'Script',
  'setup.noScript': 'This game has no script yet — import one that extends “{game}”.',
  'setup.players': 'Players',
  'setup.seats': 'Seats',
  'setup.seatsHint': 'In physical seating order — adjacency matters in play. Blank names become P1, P2, …',
  'setup.start': 'Start session',
  'setup.noGames': 'No games available — import one, or bring back the defaults.',
  'setup.importTitle': 'Import a game',
  'setup.importHint':
    'Paste a game (with phases), a script (with roles), or a { game, script } bundle. It’s validated before it’s added — nothing is saved if anything is wrong. Manage or delete installed games in Settings.',
  'setup.validateImport': 'Validate & import',
  'setup.importedPrefix': 'Imported ',

  // settings
  'settings.title': 'Settings',
  'settings.data': 'Data',
  'settings.dataHint':
    'Everything is stored on this device. Export a backup to move it to another device or keep it safe; import merges a file in (your existing games are never overwritten).',
  'settings.exportAll': 'Export everything',
  'settings.noExport': 'No games to export yet',
  'settings.exportSub': '{n} games + your configs as one file',
  'settings.importFile': 'Import a file',
  'settings.importFileSub': 'A backup, a shared game, or a config',
  'settings.importedPrefix': 'Imported ',
  'settings.appearance': 'Appearance',
  'settings.appearanceHint':
    'The four base colours — reads, relations and neutral/info — across the app and diagram. Team colours come from each game’s config.',
  'settings.customise': 'Customise colours',
  'settings.reset': 'Reset',
  'palette.default.name': 'Default',
  'palette.default.desc': 'The original palette.',
  'palette.okabe-ito.name': 'Colourblind-safe',
  'palette.okabe-ito.desc': 'Okabe–Ito — good vs evil stay distinct under red-green colour blindness.',
  'settings.games': 'Games & scripts',
  'settings.gamesHint':
    'Every game and script installed on this device. Removing a game removes its scripts too. Anything used by a saved game can’t be removed.',
  'settings.noGamesInstalled': 'No games installed.',
  'settings.gameMeta': '{min}–{max} players · {n} scripts',
  'settings.inUse': 'in use',
  'settings.language': 'Language',
  'settings.newScript': '+ New script',
  'settings.newGame': '+ New game',

  // config editor (create-only)
  'editor.newScript': 'New script',
  'editor.duplicateScript': 'Duplicate script',
  'editor.scriptName': 'Script name',
  'editor.forGame': 'Script for {game}',
  'editor.roles': 'Roles',
  'editor.roleName': 'Role name',
  'editor.team': 'Team',
  'editor.addRole': '+ Add role',
  'editor.needName': 'Give it a name.',
  'editor.needRole': 'Add at least one role.',
  'editor.newGame': 'New game',
  'editor.duplicateGame': 'Duplicate game',
  'editor.gameName': 'Game name',
  'editor.playerCount': 'Player count',
  'editor.min': 'Min',
  'editor.max': 'Max',
  'editor.teams': 'Teams',
  'editor.teamName': 'Team name',
  'editor.addTeam': '+ Add team',
  'editor.phases': 'Phases',
  'editor.setupPhases': 'Setup — once at the start (optional)',
  'editor.cyclePhases': 'Cycle — repeats each round',
  'editor.phaseName': 'Phase',
  'editor.phaseShort': 'Short',
  'editor.addPhase': '+ Add phase',
  'editor.needTeam': 'Add at least one team.',
  'editor.needPhase': 'Add at least one cycle phase.',
  // tone / summary fragments
  'tone.good': 'Good',
  'tone.evil': 'Evil',
  'tone.neutral': 'Neutral',
  'tone.info': 'Info',
  'summary.games': '{n} games',
  'summary.gameConfigs': '{n} game configs',
  'summary.scripts': '{n} scripts',
  'summary.settings': 'settings',
  'summary.nothing': 'nothing',

  // game screen
  'tab.diagram': 'Diagram',
  'tab.players': 'Players',
  'tab.log': 'Log',
  'tab.review': 'Review',
  'bar.speech': '+ Speech',
  'bar.nomination': '+ Nomination',
  'bar.event': '+ Event',

  // round bar
  'round.reviewing': 'reviewing',
  'round.finished': 'finished',
  'round.alive': '{alive} of {total} alive',
  'round.menu': 'Menu',
  'round.game': 'Game',
  'round.leave': 'Leave — keep playing',
  'round.leaveSub': 'Back to your games; this one stays open.',
  'round.end': 'End game',
  'round.endSub': 'Mark it finished. You can reopen it later.',

  // timeline
  'timeline.advance': 'Advance to next phase',
  'timeline.reviewingBanner': 'Reviewing the past · new entries record into this phase · tap to return to live',
  'timeline.undo': 'Undo last phase',

  // diagram
  'diagram.hide': 'Hide',
  'diagram.showArrows': 'Show arrows',
  'diagram.fit': 'Fit',
  'diagram.tighten': 'Tighten spacing',
  'diagram.spread': 'Spread out',
  'diagram.aria': 'Player relationship diagram',
  'diagram.dead': 'Dead',
  'diagram.quickRecord': 'Quick record',
  'diagram.nominate': 'Nominate',
  'diagram.event': 'Event',
  'diagram.roleGuess': 'Role guess',
  'diagram.editGuess': 'Edit guess',
  'diagram.noGuess': 'no guess',
  'diagram.myRead': 'My read',
  'diagram.nothingLogged': 'Nothing logged about them yet.',
  'event.died': 'died',
  'event.revived': 'revived',

  // players tab
  'players.recordDeath': 'Record death for {name}',
  'players.recordRevival': 'Record revival for {name}',
  'players.alive': 'alive',
  'players.dead': 'dead',
  'players.read': 'read',

  // log
  'log.empty': 'Nothing logged yet.',
  'log.votes': '{n} votes',
  'log.voted': 'Voted: {names}',
  'log.event': 'Event',

  // post-game review
  'review.readsRight': 'Reads right',
  'review.rolesRight': 'Roles right',
  'review.read': 'read',
  'review.guess': 'guess',
  'review.noRead': 'no read',
  'review.editResults': 'Edit results',
  'review.truthHint':
    "What was everyone, really? Set each player's alignment — and role if you know it. Saving reveals the post-mortem.",
  'review.rolePrompt': 'Role — tap to set (optional)',
  'review.saveResults': 'Save results & see post-mortem',
  'review.roleTitle': 'Role — {name}',
  'review.role': 'Role',
  'review.clearRole': 'Clear role',

  // entry sheets
  'sheet.editEntry': 'Edit entry',
  'sheet.logSpeech': 'Log what was said',
  'sheet.save': 'Save',
  'sheet.whoSpoke': 'Who spoke',
  'sheet.whatDid': 'What they did',
  'sheet.aboutWhom': 'About whom',
  'sheet.aboutWhomAny': 'About whom (any number)',
  'sheet.infoSelfHint': 'A player claiming their own role is themself as both speaker and target.',
  'sheet.rolesNamed': 'Roles named (optional)',
  'sheet.note': 'Note (optional)',
  'sheet.notePlaceholder': 'Exact words, numbers, anything odd',
  'sheet.editNomination': 'Edit nomination',
  'sheet.logNomination': 'Log a nomination',
  'sheet.nominator': 'Who nominates',
  'sheet.nominees': 'Nominates whom',
  'sheet.voters': 'Who voted (optional)',
  'sheet.votesHint': 'Votes roll up under the nomination instead of drawing their own arrows.',
  'sheet.noteAnything': 'Anything worth remembering',
  'sheet.noNominationRel': 'This game has no nomination relation configured.',
  'sheet.logEvent': 'Log an event',
  'sheet.editEvent': 'Edit event',
  'sheet.whatHappened': 'What happened',
  'sheet.eventPlaceholder': 'e.g. Executed, Died at night, Slayer shot, Quest failed',
  'sheet.whoTouched': 'Who it involves',
  'sheet.lifeEffect': 'Effect on life',
  'sheet.lifeNone': 'No change',
  'sheet.lifeDies': 'Died',
  'sheet.lifeRevives': 'Revived',
  'sheet.lifeHint': 'Applies to everyone selected above. Alive/dead is worked out from these.',
  'sheet.roleGuessTitle': 'Role guess — {name}',
  'sheet.guessTitle': 'Guess — {name}',
  'sheet.guessHint':
    'Pick every role still in play for them. This is your guess — what they claimed out loud belongs in the log instead. Your good/evil read lives on the diagram.',
  'sheet.clear': 'Clear',

  // per-entry actions
  'entry.edit': 'Edit',
  'entry.pin': 'Pin to top',
  'entry.unpin': 'Unpin',
  'entry.strike': 'Strike through (hide from diagram)',
  'entry.unstrike': 'Un-strike (show again)',
  'entry.delete': 'Delete',
  'entry.deleteEntry': 'Delete this entry?',
  'entry.deleteEvent': 'Delete this event?',

  // lean (read scale)
  'lean.-2': 'sure evil',
  'lean.-1': 'maybe evil',
  'lean.0': 'neutral',
  'lean.1': 'maybe good',
  'lean.2': 'sure good',

  // default relation vocabulary (translated by id; custom relations fall back to config)
  'relation.vouch.label': 'Vouch',
  'relation.vouch.phrase': 'vouches for',
  'relation.accuse.label': 'Accuse',
  'relation.accuse.phrase': 'accuses',
  'relation.nominate.label': 'Nominate',
  'relation.nominate.phrase': 'nominates',
  'relation.vote.label': 'Vote',
  'relation.vote.phrase': 'votes for',
  'relation.info.label': 'Info',
  'relation.info.phrase': 'gives info on',
  'relation.info.selfPhrase': 'claims',
}

const zh: Dict = {
  'common.cancel': '取消',
  'common.and': '、',
  'common.done': '完成',
  'common.duplicate': '复制',
  'common.create': '创建',
  'common.delete': '删除',
  'common.remove': '移除',
  'common.export': '导出',
  'common.close': '关闭',
  'common.restoreDefaults': '恢复默认游戏',

  'home.title': '游戏',
  'home.newGame': '+ 新游戏',
  'home.settings': '设置',
  'home.empty': '还没有游戏。开始一局以进行记录。',
  'home.ongoing': '进行中',
  'home.finished': '已结束',
  'home.players': '{n} 名玩家',
  'home.today': '今天',
  'home.yesterday': '昨天',
  'home.export': '导出…',
  'home.reopen': '重新设为进行中',
  'home.markFinished': '标记为已结束',
  'home.deleteConfirm': '删除这局游戏？此操作无法撤销。',

  'setup.title': '新对局',
  'setup.game': '游戏',
  'setup.importGame': '＋ 导入游戏',
  'setup.script': '剧本',
  'setup.noScript': '这个游戏还没有剧本 —— 导入一个扩展“{game}”的剧本。',
  'setup.players': '玩家',
  'setup.seats': '座位',
  'setup.seatsHint': '按实际座位顺序 —— 相邻关系会影响游戏。留空则记为 P1、P2……',
  'setup.start': '开始对局',
  'setup.noGames': '没有可用的游戏 —— 导入一个，或恢复默认。',
  'setup.importTitle': '导入游戏',
  'setup.importHint':
    '粘贴一个游戏（含 phases）、一个剧本（含 roles），或 { game, script } 组合。添加前会先校验 —— 有误则不保存。可在设置中管理或删除已安装的游戏。',
  'setup.validateImport': '校验并导入',
  'setup.importedPrefix': '已导入 ',

  'settings.title': '设置',
  'settings.data': '数据',
  'settings.dataHint':
    '所有数据都保存在本设备上。导出备份以迁移到其他设备或妥善留存；导入会将文件合并进来（不会覆盖你现有的游戏）。',
  'settings.exportAll': '导出全部',
  'settings.noExport': '暂无可导出的游戏',
  'settings.exportSub': '{n} 局游戏 + 你的配置，合并为一个文件',
  'settings.importFile': '导入文件',
  'settings.importFileSub': '备份、分享的游戏或配置',
  'settings.importedPrefix': '已导入 ',
  'settings.appearance': '外观',
  'settings.appearanceHint': '应用与关系图中使用的四种基础颜色 —— 判读、关系和中立/信息。队伍颜色来自各游戏的配置。',
  'settings.customise': '自定义颜色',
  'settings.reset': '重置',
  'palette.default.name': '默认',
  'palette.default.desc': '原始配色。',
  'palette.okabe-ito.name': '色盲友好',
  'palette.okabe-ito.desc': 'Okabe–Ito —— 在红绿色盲下好人与坏人依然可区分。',
  'settings.games': '游戏与剧本',
  'settings.gamesHint': '本设备上已安装的所有游戏和剧本。移除游戏会同时移除其剧本。被已保存对局使用的项目无法移除。',
  'settings.noGamesInstalled': '未安装任何游戏。',
  'settings.gameMeta': '{min}–{max} 名玩家 · {n} 个剧本',
  'settings.inUse': '使用中',
  'settings.language': '语言',
  'settings.newScript': '+ 新建剧本',
  'settings.newGame': '+ 新建游戏',

  'editor.newScript': '新建剧本',
  'editor.duplicateScript': '复制剧本',
  'editor.scriptName': '剧本名称',
  'editor.forGame': '所属游戏：{game}',
  'editor.roles': '角色',
  'editor.roleName': '角色名称',
  'editor.team': '队伍',
  'editor.addRole': '+ 添加角色',
  'editor.needName': '请填写名称。',
  'editor.needRole': '至少添加一个角色。',
  'editor.newGame': '新建游戏',
  'editor.duplicateGame': '复制游戏',
  'editor.gameName': '游戏名称',
  'editor.playerCount': '玩家人数',
  'editor.min': '最少',
  'editor.max': '最多',
  'editor.teams': '队伍',
  'editor.teamName': '队伍名称',
  'editor.addTeam': '+ 添加队伍',
  'editor.phases': '阶段',
  'editor.setupPhases': '开局阶段 —— 仅开局一次（可选）',
  'editor.cyclePhases': '循环阶段 —— 每轮重复',
  'editor.phaseName': '阶段',
  'editor.phaseShort': '简称',
  'editor.addPhase': '+ 添加阶段',
  'editor.needTeam': '至少添加一个队伍。',
  'editor.needPhase': '至少添加一个循环阶段。',
  'tone.good': '好人',
  'tone.evil': '坏人',
  'tone.neutral': '中立',
  'tone.info': '信息',
  'summary.games': '{n} 局游戏',
  'summary.gameConfigs': '{n} 个游戏配置',
  'summary.scripts': '{n} 个剧本',
  'summary.settings': '设置',
  'summary.nothing': '无内容',

  'tab.diagram': '关系图',
  'tab.players': '玩家',
  'tab.log': '记录',
  'tab.review': '复盘',
  'bar.speech': '+ 发言',
  'bar.nomination': '+ 提名',
  'bar.event': '+ 事件',

  'round.reviewing': '回看中',
  'round.finished': '已结束',
  'round.alive': '存活 {alive} / {total}',
  'round.menu': '菜单',
  'round.game': '游戏',
  'round.leave': '离开 —— 继续游戏',
  'round.leaveSub': '返回游戏列表；这一局保持开启。',
  'round.end': '结束游戏',
  'round.endSub': '标记为已结束。之后可以重新打开。',

  'timeline.advance': '进入下一阶段',
  'timeline.reviewingBanner': '正在回看过去 · 新记录会写入此阶段 · 点按返回当前',
  'timeline.undo': '撤销上一阶段',

  'diagram.hide': '隐藏',
  'diagram.showArrows': '显示箭头',
  'diagram.fit': '适配',
  'diagram.tighten': '收紧间距',
  'diagram.spread': '展开',
  'diagram.aria': '玩家关系图',
  'diagram.dead': '已死亡',
  'diagram.quickRecord': '快速记录',
  'diagram.nominate': '提名',
  'diagram.event': '事件',
  'diagram.roleGuess': '角色猜测',
  'diagram.editGuess': '编辑猜测',
  'diagram.noGuess': '无猜测',
  'diagram.myRead': '我的判读',
  'diagram.nothingLogged': '还没有关于 TA 的记录。',
  'event.died': '死亡',
  'event.revived': '复活',

  'players.recordDeath': '记录 {name} 死亡',
  'players.recordRevival': '记录 {name} 复活',
  'players.alive': '存活',
  'players.dead': '死亡',
  'players.read': '判读',

  'log.empty': '还没有记录。',
  'log.votes': '{n} 票',
  'log.voted': '投票：{names}',
  'log.event': '事件',

  'review.readsRight': '判读正确',
  'review.rolesRight': '角色正确',
  'review.read': '判读',
  'review.guess': '猜测',
  'review.noRead': '未判读',
  'review.editResults': '编辑结果',
  'review.truthHint': '大家实际上都是什么？为每位玩家设定阵营 —— 知道角色也可填上。保存后即可查看复盘。',
  'review.rolePrompt': '角色 —— 点按设定（可选）',
  'review.saveResults': '保存结果并查看复盘',
  'review.roleTitle': '角色 —— {name}',
  'review.role': '角色',
  'review.clearRole': '清除角色',

  'sheet.editEntry': '编辑记录',
  'sheet.logSpeech': '记录发言',
  'sheet.save': '保存',
  'sheet.whoSpoke': '谁发言',
  'sheet.whatDid': '做了什么',
  'sheet.aboutWhom': '关于谁',
  'sheet.aboutWhomAny': '关于谁（任意数量）',
  'sheet.infoSelfHint': '玩家自称角色时，发言者和对象都是自己。',
  'sheet.rolesNamed': '提到的角色（可选）',
  'sheet.note': '备注（可选）',
  'sheet.notePlaceholder': '原话、数字或任何异常',
  'sheet.editNomination': '编辑提名',
  'sheet.logNomination': '记录提名',
  'sheet.nominator': '谁提名',
  'sheet.nominees': '提名谁',
  'sheet.voters': '谁投票（可选）',
  'sheet.votesHint': '投票会归入提名之下，而不单独画出箭头。',
  'sheet.noteAnything': '任何值得记住的内容',
  'sheet.noNominationRel': '该游戏未配置提名关系。',
  'sheet.logEvent': '记录事件',
  'sheet.editEvent': '编辑事件',
  'sheet.whatHappened': '发生了什么',
  'sheet.eventPlaceholder': '例如：处决、夜晚死亡、杀手开枪、任务失败',
  'sheet.whoTouched': '涉及谁',
  'sheet.lifeEffect': '生死影响',
  'sheet.lifeNone': '无变化',
  'sheet.lifeDies': '死亡',
  'sheet.lifeRevives': '复活',
  'sheet.lifeHint': '作用于上面选中的所有人。存活/死亡由此推算。',
  'sheet.roleGuessTitle': '角色猜测 —— {name}',
  'sheet.guessTitle': '猜测 —— {name}',
  'sheet.guessHint': '选出你认为仍可能的所有角色。这是你的猜测 —— 他们公开自称的内容应记入日志。你的好人/坏人判读在关系图上。',
  'sheet.clear': '清除',

  'entry.edit': '编辑',
  'entry.pin': '置顶',
  'entry.unpin': '取消置顶',
  'entry.strike': '加删除线（从关系图隐藏）',
  'entry.unstrike': '取消删除线（重新显示）',
  'entry.delete': '删除',
  'entry.deleteEntry': '删除这条记录？',
  'entry.deleteEvent': '删除这个事件？',

  'lean.-2': '一定坏人',
  'lean.-1': '可能坏人',
  'lean.0': '中立',
  'lean.1': '可能好人',
  'lean.2': '一定好人',

  'relation.vouch.label': '担保',
  'relation.vouch.phrase': '担保',
  'relation.accuse.label': '指控',
  'relation.accuse.phrase': '指控',
  'relation.nominate.label': '提名',
  'relation.nominate.phrase': '提名',
  'relation.vote.label': '投票',
  'relation.vote.phrase': '投票给',
  'relation.info.label': '信息',
  'relation.info.phrase': '报点',
  'relation.info.selfPhrase': '自称',
}

const DICTS: Record<Lang, Dict> = { en, zh }

type Params = Record<string, string | number>

function interpolate(s: string, params?: Params): string {
  if (!params) return s
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`))
}

function translate(lang: Lang, key: string, params?: Params): string {
  const raw = DICTS[lang][key] ?? en[key] ?? key
  return interpolate(raw, params)
}

function hasKey(lang: Lang, key: string): boolean {
  return key in DICTS[lang] || key in en
}

export type TFn = (key: string, params?: Params) => string
export type TOrFn = (key: string, fallback: string, params?: Params) => string

/** Reactive translator for components — re-renders when the language changes. */
export function useT(): { t: TFn; tOr: TOrFn; lang: Lang } {
  const lang = useSettings((s) => s.language)
  return {
    t: (key, params) => translate(lang, key, params),
    tOr: (key, fallback, params) => (hasKey(lang, key) ? translate(lang, key, params) : fallback),
    lang,
  }
}

// Module-level lookup for non-component helpers (describe.ts). Reads the current
// language; a component rendering its output must subscribe to `language` (via useT)
// so it re-renders on a language change.
export function tOr(key: string, fallback: string, params?: Params): string {
  const lang = useSettings.getState().language
  return hasKey(lang, key) ? translate(lang, key, params) : fallback
}

/** A relation's button label — translated for the shipped defaults, else as authored. */
export function relationLabel(relation: { id: string; label: string }): string {
  return tOr(`relation.${relation.id}.label`, relation.label)
}

/** A relation's log verb — translated for the shipped defaults, else as authored. */
export function relationPhrase(relation: { id: string; phrase: string; selfPhrase?: string }, self: boolean): string {
  if (self && relation.selfPhrase) return tOr(`relation.${relation.id}.selfPhrase`, relation.selfPhrase)
  return tOr(`relation.${relation.id}.phrase`, relation.phrase)
}
