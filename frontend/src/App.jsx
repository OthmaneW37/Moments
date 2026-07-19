import { useCallback, useEffect, useState } from 'react'
import { addDays, api, getToken, mondayOf, prettyDate, toISO } from './api'
import AuthScreen from './components/AuthScreen'
import WeekStrip from './components/WeekStrip'
import EventCard from './components/EventCard'
import EventForm from './components/EventForm'
import NewMoment from './components/NewMoment'
import Feed from './components/Feed'
import Discover from './components/Discover'
import Notifications from './components/Notifications'
import Profile from './components/Profile'
import Recap from './components/Recap'
import Timeline from './components/Timeline'
import Icon from './components/Icon'
import UserSheet from './components/UserSheet'
import Messages from './components/Messages'
import SearchUsers from './components/SearchUsers'
import SharedMoment from './components/SharedMoment'

export default function App() {
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)

  const [view, setView] = useState('feed') // feed | discover | day | profile | notifs | messages | search
  const [dayTab, setDayTab] = useState('day') // day | timeline
  const [date, setDate] = useState(toISO(new Date()))
  const [events, setEvents] = useState([])
  const [weekSummary, setWeekSummary] = useState({})
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [capturing, setCapturing] = useState(false) // écran capture-first du +
  const [feedNonce, setFeedNonce] = useState(0)     // force le refetch du feed après un post
  const [notifs, setNotifs] = useState(null)
  const [dmUnread, setDmUnread] = useState(0)
  const [dmWith, setDmWith] = useState(null) // ouvrir directement une conv
  const [userSheet, setUserSheet] = useState(null) // profil ouvert depuis Profil/Notifs

  // Route publique de partage : /s/<token> — aucune authentification requise
  const sharePath = window.location.pathname.match(/^\/s\/([a-zA-Z0-9]+)/)
  const openMessages = (username) => { setDmWith(username || null); setView('messages') }

  useEffect(() => {
    if (!getToken()) { setAuthChecked(true); return }
    api.me().then((u) => setUser(u)).catch(() => {}).finally(() => setAuthChecked(true))
  }, [])

  useEffect(() => {
    if (!user) return
    const load = () => {
      api.notifications().then(setNotifs).catch(() => {})
      api.conversations().then((d) => setDmUnread(d.unread)).catch(() => {})
    }
    load()
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [user])

  const markNotifsSeen = useCallback(() => {
    api.markNotificationsRead().then(() => api.notifications().then(setNotifs)).catch(() => {})
  }, [])

  const refresh = useCallback(async () => {
    if (!user) return
    const monday = mondayOf(date)
    const [evts, summary] = await Promise.all([
      api.eventsForDate(date),
      api.eventsRange(monday, addDays(monday, 6)),
    ])
    setEvents(evts)
    setWeekSummary(summary)
  }, [date, user])

  useEffect(() => { refresh().catch(console.error) }, [refresh])

  async function handleSave(data) {
    if (editing) await api.updateEvent(editing.id, data)
    else await api.createEvent(data)
    setFormOpen(false)
    setEditing(null)
    refresh()
  }

  function openNewMoment() {
    setEditing(null)
    setCapturing(true)
  }

  async function handleMomentPosted() {
    setCapturing(false)
    await refresh()
    setDate(toISO(new Date()))
    setFeedNonce((n) => n + 1)
    setView('feed')
  }

  // Page publique de partage — court-circuite l'auth
  if (sharePath) {
    return <SharedMoment token={sharePath[1]} />
  }

  if (!authChecked) {
    return <div className="phone"><p className="muted center">📸</p></div>
  }

  if (!user) {
    return (
      <div className="phone">
        <AuthScreen onAuthed={(u) => { setUser(u); setView('feed') }} />
      </div>
    )
  }

  const captured = events.filter((e) => e.photos.length > 0).length
  const unread = notifs?.unread ?? 0

  return (
    <div className="phone">
      <header className="topbar">
        <div className="brand">
          <Icon emoji="📸" size="26" className="brand-logo" />
          <span className="brand-name">Moments</span>
        </div>
        <div className="topbar-actions">
          <button
            className={`topbar-bell ${view === 'search' ? 'active' : ''}`}
            onClick={() => setView('search')}
            aria-label="Rechercher un compte"
          >
            <Icon name="search" size="21" />
          </button>
          <button
            className={`topbar-bell ${view === 'messages' ? 'active' : ''}`}
            onClick={() => openMessages(null)}
            aria-label="Messages"
          >
            <Icon name="message" size="21" />
            {dmUnread > 0 && <span className="bell-badge">{dmUnread > 9 ? '9+' : dmUnread}</span>}
          </button>
          <button
            className={`topbar-bell ${view === 'notifs' ? 'active' : ''}`}
            onClick={() => setView('notifs')}
            aria-label="Notifications"
          >
            <Icon emoji="🔔" size="22" />
            {unread > 0 && <span className="bell-badge">{unread > 9 ? '9+' : unread}</span>}
          </button>
          <button className="topbar-user" onClick={() => setView('profile')}>
            <Icon emoji={user.emoji} size="24" />
          </button>
        </div>
      </header>

      <div className={`screen ${view === 'feed' ? 'screen--immersive' : ''}`}>
        {view === 'feed' && <Feed key={`${date}-${feedNonce}`} onMessage={openMessages} />}

        {view === 'discover' && <Discover onMessage={openMessages} />}

        {view === 'search' && <SearchUsers onOpenUser={setUserSheet} />}

        {view === 'messages' && (
          <Messages
            openWith={dmWith}
            onConsumeOpen={() => setDmWith(null)}
            onOpenUser={setUserSheet}
          />
        )}

        {view === 'notifs' && (
          <Notifications
            data={notifs}
            onSeen={markNotifsSeen}
            goProfile={() => setView('profile')}
            goFeed={() => setView('feed')}
            goMessages={openMessages}
          />
        )}

        {view === 'day' && (
          <main className="day-view">
            <div className="seg-toggle">
              <button className={dayTab === 'day' ? 'active' : ''} onClick={() => setDayTab('day')}>Jour</button>
              <button className={dayTab === 'timeline' ? 'active' : ''} onClick={() => setDayTab('timeline')}>Timeline</button>
            </div>

            {dayTab === 'timeline' ? (
              <Timeline />
            ) : (
              <>
                <WeekStrip selectedDate={date} summary={weekSummary} onSelect={setDate} />
                <div className="day-header">
                  <h1>{prettyDate(date)}</h1>
                  <div className="day-sub">
                    <p className="muted">
                      {events.length === 0
                        ? 'Rien de prévu'
                        : `${events.length} moment(s) · ${captured} capturé(s) 📸`}
                    </p>
                    {date !== toISO(new Date()) && (
                      <button className="link-btn" onClick={() => setDate(toISO(new Date()))}>
                        Revenir à aujourd'hui
                      </button>
                    )}
                  </div>
                </div>

                {events.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-emoji">🗓️</span>
                    <h3>Journée libre</h3>
                    <p>Une vidéo au petit-déj, un ciné à midi, la finale au café ce soir…</p>
                    <button className="btn primary" onClick={openNewMoment}>Planifier un moment</button>
                  </div>
                ) : (
                  <div className="event-list">
                    {events.map((e) => (
                      <EventCard
                        key={e.id}
                        event={e}
                        onChanged={refresh}
                        onEdit={(evt) => { setEditing(evt); setFormOpen(true) }}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </main>
        )}

        {view === 'profile' && (
          <Profile
            user={user}
            onUserChange={setUser}
            onOpenRecap={() => setView('recap')}
            onOpenUser={setUserSheet}
            onLogout={() => { setUser(null); setView('feed') }}
          />
        )}

        {view === 'recap' && <Recap onBack={() => setView('profile')} />}
      </div>

      <nav className="bottom-nav">
        <button className={`nav-item ${view === 'feed' ? 'active' : ''}`} onClick={() => setView('feed')}>
          <Icon emoji="🫂" size="24" className="nav-icon" />
          <span className="nav-label">Feed</span>
        </button>
        <button className={`nav-item ${view === 'discover' ? 'active' : ''}`} onClick={() => setView('discover')}>
          <Icon emoji="🌍" size="24" className="nav-icon" />
          <span className="nav-label">Découverte</span>
        </button>

        <button className="fab" onClick={openNewMoment} aria-label="Nouveau moment">＋</button>

        <button className={`nav-item ${view === 'day' ? 'active' : ''}`} onClick={() => setView('day')}>
          <Icon emoji="🗓️" size="24" className="nav-icon" />
          <span className="nav-label">Agenda</span>
        </button>
        <button className={`nav-item ${view === 'profile' || view === 'recap' ? 'active' : ''}`} onClick={() => setView('profile')}>
          <Icon emoji="👤" size="24" className="nav-icon" />
          <span className="nav-label">Profil</span>
        </button>
      </nav>

      {formOpen && (
        <EventForm
          date={date}
          initial={editing}
          onSave={handleSave}
          onCancel={() => { setFormOpen(false); setEditing(null) }}
        />
      )}

      {userSheet && (
        <UserSheet
          username={userSheet}
          onClose={() => setUserSheet(null)}
          onOpenUser={setUserSheet}
          onMessage={(u) => { setUserSheet(null); openMessages(u) }}
        />
      )}

      {capturing && (
        <NewMoment onDone={handleMomentPosted} onCancel={() => setCapturing(false)} />
      )}
    </div>
  )
}
