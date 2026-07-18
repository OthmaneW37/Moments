import { addDays, dayLabel, mondayOf, toISO } from '../api'

export default function WeekStrip({ selectedDate, summary, onSelect }) {
  const monday = mondayOf(selectedDate)
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const today = toISO(new Date())

  return (
    <div className="week-strip">
      <button className="week-nav" onClick={() => onSelect(addDays(selectedDate, -7))}>‹</button>
      {days.map((iso) => {
        const info = summary[iso]
        const isSelected = iso === selectedDate
        const isToday = iso === today
        return (
          <button
            key={iso}
            className={`day-pill ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
            onClick={() => onSelect(iso)}
          >
            <span className="day-name">{dayLabel(iso)}</span>
            <span className="day-num">{Number(iso.slice(8))}</span>
            <span className="day-dots">
              {info?.events > 0 && <span className="dot events" title={`${info.events} événement(s)`} />}
              {info?.photos > 0 && <span className="dot photos" title={`${info.photos} photo(s)`} />}
            </span>
          </button>
        )
      })}
      <button className="week-nav" onClick={() => onSelect(addDays(selectedDate, 7))}>›</button>
    </div>
  )
}
