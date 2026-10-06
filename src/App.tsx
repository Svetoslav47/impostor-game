import { useCallback, useEffect, useState } from 'react'
import { ConfirmDialog, Toast, type ConfirmOptions } from './components/Overlays'
import { ALL_CATEGORY_IDS } from './lib/categories'
import { dealRound, type LocalRound } from './lib/game'
import { loadSession, useOnline } from './lib/online'
import { useServerHealth } from './lib/server'
import { loadOnlineName, loadSettings, playerNames, saveOnlineName, saveSettings, type LocalSettings } from './lib/settings'
import { Countdown } from './screens/Countdown'
import { Home, type Tab } from './screens/Home'
import { Lobby } from './screens/Lobby'
import { Names } from './screens/Names'
import { OnlineCard } from './screens/OnlineCard'
import { Pass } from './screens/Pass'
import { Starter } from './screens/Starter'

type LocalView = 'home' | 'names' | 'pass' | 'starter'

export default function App() {
  const [settings, setSettingsState] = useState<LocalSettings>(loadSettings)
  const [tab, setTab] = useState<Tab>(() => (loadSession() ? 'online' : 'local'))
  const [view, setView] = useState<LocalView>('home')
  const [round, setRound] = useState<LocalRound | null>(null)
  const [roundNo, setRoundNo] = useState(0)
  const [passIndex, setPassIndex] = useState(0)
  const [seen, setSeen] = useState(false)
  const [onlineName, setOnlineName] = useState(loadOnlineName)
  const [pending, setPending] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ConfirmOptions | null>(null)

  const health = useServerHealth()
  const showError = useCallback((m: string) => {
    setPending(false)
    setToast(m)
  }, [])
  const online = useOnline(tab === 'online' && health === 'up', showError)
  const room = online.room
  const me = online.session?.playerId ?? ''

  useEffect(() => {
    if (room) setPending(false)
  }, [room])

  // Scroll to top whenever the screen changes.
  const screenKey = room ? `online-${room.phase}` : `${view}-${tab}`
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [screenKey])

  const setSettings = (s: LocalSettings) => {
    setSettingsState(s)
    saveSettings(s)
  }

  const deal = () => {
    setRound(dealRound(playerNames(settings), settings.impostorCount, settings.categoryIds))
    setRoundNo((n) => n + 1)
    setPassIndex(0)
    setSeen(false)
    setView('pass')
  }

  const closeConfirm = useCallback(() => setConfirm(null), [])
  const dismissToast = useCallback(() => setToast(null), [])

  const leaveRoom = () => {
    const inGame = room && room.phase !== 'lobby'
    if (!inGame) return online.leave()
    setConfirm({
      title: 'Напускаш стаята?',
      message: 'Играта продължава без теб.',
      confirmLabel: 'Напусни',
      destructive: true,
      onConfirm: online.leave,
    })
  }

  let screen
  if (room && me) {
    if (room.phase === 'lobby') {
      screen = <Lobby room={room} me={me} onLeave={leaveRoom} onSettings={online.updateSettings} onStart={online.start} />
    } else if (room.phase === 'countdown') {
      screen = <Countdown room={room} endsAt={online.countdownEndsAt} totalMs={online.countdownTotalMs} />
    } else {
      screen = (
        <OnlineCard
          room={room}
          me={me}
          card={online.card}
          onLeave={leaveRoom}
          onNewGame={online.start}
          onReveal={() =>
            setConfirm({
              title: 'Разкрий думата за всички?',
              message: 'Всички ще видят думата и импостора.',
              confirmLabel: 'Разкрий',
              destructive: true,
              onConfirm: online.reveal,
            })
          }
        />
      )
    }
  } else if (view === 'names') {
    screen = <Names settings={settings} onSettings={setSettings} onBack={() => setView('home')} />
  } else if (view === 'pass' && round) {
    screen = (
      <Pass
        round={round}
        index={passIndex}
        seen={seen}
        onSeen={() => setSeen(true)}
        onNext={() => {
          if (passIndex + 1 >= round.players.length) setView('starter')
          else {
            setPassIndex(passIndex + 1)
            setSeen(false)
          }
        }}
        onExit={() =>
          setConfirm({
            title: 'Прекрати играта?',
            message: 'Картите ще бъдат раздадени отначало.',
            confirmLabel: 'Изход',
            destructive: true,
            onConfirm: () => setView('home'),
          })
        }
      />
    )
  } else if (view === 'starter' && round) {
    screen = <Starter round={round} roundKey={roundNo} onNewGame={deal} onSettings={() => setView('home')} />
  } else {
    const showOnline = health === 'up'
    screen = (
      <Home
        tab={showOnline ? tab : 'local'}
        onTab={setTab}
        showOnline={showOnline}
        settings={settings}
        onSettings={setSettings}
        onEditNames={() => setView('names')}
        onStart={deal}
        online={{
          status: online.status,
          name: onlineName,
          busy: pending || (online.session !== null && !room),
          onName: (n) => {
            setOnlineName(n)
            saveOnlineName(n)
          },
          onCreate: () => {
            setPending(true)
            online.create(onlineName.trim(), {
              impostorCount: settings.impostorCount,
              categoryIds: settings.categoryIds.length ? settings.categoryIds : ALL_CATEGORY_IDS,
            })
          },
          onJoin: (code) => {
            setPending(true)
            online.join(code, onlineName.trim())
          },
        }}
      />
    )
  }

  return (
    <>
      {screen}
      {toast && <Toast message={toast} onDismiss={dismissToast} />}
      {confirm && <ConfirmDialog options={confirm} onClose={closeConfirm} />}
    </>
  )
}
