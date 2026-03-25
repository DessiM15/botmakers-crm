'use client';

import { useState, useRef, useCallback, useTransition, useMemo } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';
import Link from 'next/link';
import { toast } from 'react-toastify';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { createMeeting } from '@/lib/actions/meetings';
import { saveCalendarColors } from '@/lib/actions/settings';
import {
  CALENDAR_CATEGORIES,
  DEFAULT_CALENDAR_COLORS,
  CALENDAR_PRESET_COLORS,
} from '@/lib/utils/constants';

/** Returns '#fff' or '#000' based on luminance of hex color */
function contrastText(hex) {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000' : '#fff';
}

const CalendarView = ({ clients = [], leads = [], savedColors = null }) => {
  const calendarRef = useRef(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Color & visibility state
  const [colors, setColors] = useState(() => ({
    ...DEFAULT_CALENDAR_COLORS,
    ...(savedColors || {}),
  }));
  const [visibility, setVisibility] = useState({
    meeting: true,
    calcom: true,
    website: true,
    milestone: true,
  });
  const [colorPickerOpen, setColorPickerOpen] = useState(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    meetingUrl: '',
    attendeeName: '',
    attendeeEmail: '',
    clientId: '',
    leadId: '',
  });

  const fetchEvents = useCallback(async (fetchInfo) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start: fetchInfo.startStr,
        end: fetchInfo.endStr,
      });
      const res = await fetch(`/api/calendar/events?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setEvents(data);
    } catch {
      toast.error('Failed to load calendar events');
    }
    setLoading(false);
  }, []);

  // Filter events based on visibility toggles
  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      const cat = evt.extendedProps?.category;
      if (!cat) return true;
      return visibility[cat] !== false;
    });
  }, [events, visibility]);

  // Apply colors via eventDidMount
  const eventDidMount = useCallback(
    (info) => {
      const props = info.event.extendedProps || {};
      const cat = props.category;
      let bg;
      if (props.isCancelled) {
        bg = colors.cancelled || DEFAULT_CALENDAR_COLORS.cancelled;
      } else if (cat === 'milestone' && props.isOverdue) {
        bg = colors.milestone_overdue || DEFAULT_CALENDAR_COLORS.milestone_overdue;
      } else {
        bg = colors[cat] || DEFAULT_CALENDAR_COLORS[cat] || '#0d6efd';
      }
      const txt = contrastText(bg);
      if (info.el) {
        info.el.style.backgroundColor = bg;
        info.el.style.borderColor = bg;
        info.el.style.color = txt;
        // Also style inner elements for time grid
        const fc = info.el.querySelector('.fc-event-main');
        if (fc) fc.style.color = txt;
      }
    },
    [colors]
  );

  // Upcoming events: today + next ~8, sorted by start
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return events
      .filter((evt) => {
        const cat = evt.extendedProps?.category;
        if (visibility[cat] === false) return false;
        const s = new Date(evt.start);
        return s >= now;
      })
      .sort((a, b) => new Date(a.start) - new Date(b.start))
      .slice(0, 8);
  }, [events, visibility]);

  const handleEventClick = (clickInfo) => {
    const { extendedProps } = clickInfo.event;
    setSelectedEvent({
      title: clickInfo.event.title,
      start: clickInfo.event.start,
      end: clickInfo.event.end,
      allDay: clickInfo.event.allDay,
      ...extendedProps,
    });
  };

  const handleDateClick = (dateInfo) => {
    const clickedDate = dateInfo.date;
    const startTime = new Date(clickedDate);
    if (dateInfo.allDay) {
      startTime.setHours(10, 0, 0, 0);
    }
    const endTime = new Date(startTime.getTime() + 3600000);

    const toLocalISO = (d) => {
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    setForm({
      title: '',
      description: '',
      startTime: toLocalISO(startTime),
      endTime: toLocalISO(endTime),
      meetingUrl: '',
      attendeeName: '',
      attendeeEmail: '',
      clientId: '',
      leadId: '',
    });
    setShowCreateModal(true);
  };

  const handleCreateMeeting = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }

    startTransition(async () => {
      const result = await createMeeting({
        ...form,
        clientId: form.clientId || null,
        leadId: form.leadId || null,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Meeting created');
        setShowCreateModal(false);
        const api = calendarRef.current?.getApi();
        if (api) {
          const view = api.view;
          fetchEvents({
            startStr: view.activeStart.toISOString(),
            endStr: view.activeEnd.toISOString(),
          });
        }
      }
    });
  };

  const toggleVisibility = (key) => {
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleColorChange = async (key, newColor) => {
    const updated = { ...colors, [key]: newColor };
    setColors(updated);
    setColorPickerOpen(null);
    // Re-render events on the calendar
    const api = calendarRef.current?.getApi();
    if (api) {
      // Force re-render by re-fetching the same date range
      const view = api.view;
      fetchEvents({
        startStr: view.activeStart.toISOString(),
        endStr: view.activeEnd.toISOString(),
      });
    }
    // Persist
    const result = await saveCalendarColors(updated);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Calendar color saved');
    }
  };

  const closeDetailModal = () => setSelectedEvent(null);

  const getEventColor = (evt) => {
    const props = evt.extendedProps || {};
    if (props.isCancelled) return colors.cancelled;
    if (props.category === 'milestone' && props.isOverdue) return colors.milestone_overdue;
    return colors[props.category] || '#0d6efd';
  };

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h4 className="text-white fw-semibold mb-0">Calendar</h4>
      </div>

      <div className="row">
        {/* Sidebar */}
        <div className="col-xxl-3 col-xl-4 mb-4 mb-xxl-0">
          <div className="card h-100">
            <div className="card-body">
              {/* Add Event */}
              <button
                className="btn btn-primary w-100 mb-4"
                onClick={() => {
                  const now = new Date();
                  const toLocalISO = (d) => {
                    const pad = (n) => String(n).padStart(2, '0');
                    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                  };
                  const end = new Date(now.getTime() + 3600000);
                  setForm({
                    title: '',
                    description: '',
                    startTime: toLocalISO(now),
                    endTime: toLocalISO(end),
                    meetingUrl: '',
                    attendeeName: '',
                    attendeeEmail: '',
                    clientId: '',
                    leadId: '',
                  });
                  setShowCreateModal(true);
                }}
              >
                <Icon icon="mdi:plus" className="me-1" style={{ fontSize: '18px' }} />
                Add Event
              </button>

              {/* Sources */}
              <h6 className="text-secondary-light text-xs fw-semibold text-uppercase mb-3">
                Sources
              </h6>
              <div className="d-flex flex-column gap-2 mb-4">
                {CALENDAR_CATEGORIES.map((cat) => (
                  <div
                    key={cat.key}
                    className="d-flex align-items-center gap-2"
                  >
                    {/* Color dot — click to open picker */}
                    <div className="position-relative">
                      <button
                        className="btn p-0 border-0"
                        onClick={() =>
                          setColorPickerOpen(
                            colorPickerOpen === cat.key ? null : cat.key
                          )
                        }
                        title="Change color"
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          backgroundColor: colors[cat.key] || DEFAULT_CALENDAR_COLORS[cat.key],
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      />
                      {colorPickerOpen === cat.key && (
                        <SwatchPicker
                          currentColor={colors[cat.key] || DEFAULT_CALENDAR_COLORS[cat.key]}
                          onSelect={(c) => handleColorChange(cat.key, c)}
                          onClose={() => setColorPickerOpen(null)}
                        />
                      )}
                    </div>

                    {/* Icon + label */}
                    <Icon
                      icon={cat.icon}
                      className="text-secondary-light flex-shrink-0"
                      style={{ fontSize: '16px' }}
                    />
                    <span className="text-white text-sm flex-grow-1">
                      {cat.label}
                    </span>

                    {/* Toggle */}
                    <div className="form-check form-switch mb-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        checked={visibility[cat.key]}
                        onChange={() => toggleVisibility(cat.key)}
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Upcoming Events */}
              <h6 className="text-secondary-light text-xs fw-semibold text-uppercase mb-3">
                Upcoming
              </h6>
              {upcomingEvents.length === 0 ? (
                <p className="text-secondary-light text-sm mb-0">
                  No upcoming events
                </p>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {upcomingEvents.map((evt) => {
                    const evtColor = getEventColor(evt);
                    const startDate = new Date(evt.start);
                    const isToday =
                      startDate.toDateString() === new Date().toDateString();
                    return (
                      <button
                        key={evt.id}
                        className="btn p-0 border-0 text-start d-flex align-items-start gap-2"
                        onClick={() => {
                          setSelectedEvent({
                            title: evt.title,
                            start: new Date(evt.start),
                            end: evt.end ? new Date(evt.end) : null,
                            allDay: evt.allDay || false,
                            ...(evt.extendedProps || {}),
                          });
                        }}
                        style={{ background: 'none' }}
                      >
                        <span
                          className="flex-shrink-0 mt-1"
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: evtColor,
                          }}
                        />
                        <div className="flex-grow-1" style={{ minWidth: 0 }}>
                          <div
                            className="text-white text-sm text-truncate"
                            style={{ lineHeight: 1.3 }}
                          >
                            {evt.title}
                          </div>
                          <div className="text-secondary-light text-xs">
                            {isToday
                              ? 'Today'
                              : startDate.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                            {!evt.allDay && (
                              <>
                                {' '}
                                {startDate.toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="col-xxl-9 col-xl-8">
          <div className="card">
            <div className="card-body">
              {loading && (
                <div className="text-center py-2">
                  <div
                    className="spinner-border spinner-border-sm text-primary"
                    role="status"
                  />
                </div>
              )}
              <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,timeGridWeek,timeGridDay',
                }}
                events={filteredEvents}
                datesSet={fetchEvents}
                eventClick={handleEventClick}
                dateClick={handleDateClick}
                eventDidMount={eventDidMount}
                height="auto"
                nowIndicator
                editable={false}
                selectable={false}
                eventDisplay="block"
                dayMaxEvents={4}
                moreLinkClick="popover"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div
          className="position-fixed d-flex align-items-center justify-content-center"
          style={{ inset: 0, zIndex: 1060, background: 'rgba(0,0,0,0.5)' }}
          onClick={closeDetailModal}
        >
          <div
            className="card shadow-lg"
            style={{ width: 420, maxHeight: '80vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header d-flex align-items-center justify-content-between py-3">
              <h6 className="text-white fw-semibold mb-0">
                {selectedEvent.type === 'milestone' ? 'Milestone' : 'Meeting'}{' '}
                Details
              </h6>
              <button
                className="btn-close btn-close-white"
                onClick={closeDetailModal}
              />
            </div>
            <div className="card-body">
              <h5 className="text-white fw-semibold mb-3">
                {selectedEvent.title}
              </h5>

              {selectedEvent.type === 'meeting' && (
                <>
                  <div className="mb-2">
                    <span className="text-secondary-light text-xs d-block mb-1">
                      Time
                    </span>
                    <span className="text-white text-sm">
                      {selectedEvent.start?.toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                      {selectedEvent.end && (
                        <>
                          {' – '}
                          {selectedEvent.end.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </>
                      )}
                    </span>
                  </div>
                  {selectedEvent.attendeeName && (
                    <div className="mb-2">
                      <span className="text-secondary-light text-xs d-block mb-1">
                        Attendee
                      </span>
                      <span className="text-white text-sm">
                        {selectedEvent.attendeeName}
                        {selectedEvent.attendeeEmail &&
                          ` (${selectedEvent.attendeeEmail})`}
                      </span>
                    </div>
                  )}
                  {selectedEvent.status && (
                    <div className="mb-2">
                      <span className="text-secondary-light text-xs d-block mb-1">
                        Status
                      </span>
                      <span className="text-white text-sm text-capitalize">
                        {selectedEvent.status.replace('_', ' ')}
                      </span>
                    </div>
                  )}
                  {selectedEvent.source && (
                    <div className="mb-2">
                      <span className="text-secondary-light text-xs d-block mb-1">
                        Source
                      </span>
                      <span className="text-white text-sm text-capitalize">
                        {selectedEvent.source}
                      </span>
                    </div>
                  )}
                  {selectedEvent.meetingUrl && (
                    <a
                      href={selectedEvent.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-primary mt-2"
                    >
                      <Icon icon="mdi:video-outline" className="me-1" /> Join
                      Meeting
                    </a>
                  )}
                </>
              )}

              {selectedEvent.type === 'milestone' && (
                <>
                  <div className="mb-2">
                    <span className="text-secondary-light text-xs d-block mb-1">
                      Due Date
                    </span>
                    <span className="text-white text-sm">
                      {selectedEvent.start?.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  {selectedEvent.projectName && (
                    <div className="mb-2">
                      <span className="text-secondary-light text-xs d-block mb-1">
                        Project
                      </span>
                      <Link
                        href={`/projects/${selectedEvent.projectId}`}
                        className="text-primary text-sm text-decoration-none"
                      >
                        {selectedEvent.projectName}
                      </Link>
                    </div>
                  )}
                  {selectedEvent.status && (
                    <div className="mb-2">
                      <span className="text-secondary-light text-xs d-block mb-1">
                        Status
                      </span>
                      <span className="text-white text-sm text-capitalize">
                        {selectedEvent.status.replace('_', ' ')}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Meeting Modal */}
      {showCreateModal && (
        <div
          className="position-fixed d-flex align-items-center justify-content-center"
          style={{ inset: 0, zIndex: 1060, background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="card shadow-lg"
            style={{ width: 480, maxHeight: '85vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header d-flex align-items-center justify-content-between py-3">
              <h6 className="text-white fw-semibold mb-0">New Meeting</h6>
              <button
                className="btn-close btn-close-white"
                onClick={() => setShowCreateModal(false)}
              />
            </div>
            <div className="card-body">
              <form onSubmit={handleCreateMeeting}>
                <div className="mb-3">
                  <label className="form-label text-sm">Title *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.title}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, title: e.target.value }))
                    }
                    placeholder="Meeting title"
                    required
                  />
                </div>
                <div className="row mb-3">
                  <div className="col-6">
                    <label className="form-label text-sm">Start *</label>
                    <input
                      type="datetime-local"
                      className="form-control"
                      value={form.startTime}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, startTime: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label text-sm">End *</label>
                    <input
                      type="datetime-local"
                      className="form-control"
                      value={form.endTime}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, endTime: e.target.value }))
                      }
                      required
                    />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label text-sm">Description</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    placeholder="Optional description"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label text-sm">Meeting URL</label>
                  <input
                    type="url"
                    className="form-control"
                    value={form.meetingUrl}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, meetingUrl: e.target.value }))
                    }
                    placeholder="https://zoom.us/j/..."
                  />
                </div>
                <div className="row mb-3">
                  <div className="col-6">
                    <label className="form-label text-sm">Attendee Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.attendeeName}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          attendeeName: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label text-sm">
                      Attendee Email
                    </label>
                    <input
                      type="email"
                      className="form-control"
                      value={form.attendeeEmail}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          attendeeEmail: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="row mb-3">
                  <div className="col-6">
                    <label className="form-label text-sm">Client</label>
                    <select
                      className="form-select"
                      value={form.clientId}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          clientId: e.target.value,
                          leadId: '',
                        }))
                      }
                    >
                      <option value="">None</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.fullName || c.company || c.email}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-6">
                    <label className="form-label text-sm">Lead</label>
                    <select
                      className="form-select"
                      value={form.leadId}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          leadId: e.target.value,
                          clientId: '',
                        }))
                      }
                    >
                      <option value="">None</option>
                      {leads.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.fullName || l.email}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isPending}
                  >
                    {isPending ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" />{' '}
                        Creating...
                      </>
                    ) : (
                      'Create Meeting'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/** Preset color swatch picker dropdown */
function SwatchPicker({ currentColor, onSelect, onClose }) {
  return (
    <>
      {/* Invisible backdrop to close */}
      <div
        className="position-fixed"
        style={{ inset: 0, zIndex: 1049 }}
        onClick={onClose}
      />
      <div
        className="position-absolute shadow-lg rounded p-2"
        style={{
          top: '100%',
          left: 0,
          zIndex: 1050,
          background: '#1a1f2e',
          border: '1px solid rgba(255,255,255,0.1)',
          width: 176,
          marginTop: 4,
        }}
      >
        <div className="d-flex flex-wrap gap-1">
          {CALENDAR_PRESET_COLORS.map((c) => (
            <button
              key={c}
              className="btn p-0 border-0 position-relative"
              style={{
                width: 24,
                height: 24,
                borderRadius: '4px',
                backgroundColor: c,
                cursor: 'pointer',
                outline:
                  c === currentColor
                    ? '2px solid #fff'
                    : '1px solid rgba(255,255,255,0.15)',
                outlineOffset: 1,
              }}
              onClick={() => onSelect(c)}
              title={c}
            />
          ))}
        </div>
      </div>
    </>
  );
}

export default CalendarView;
