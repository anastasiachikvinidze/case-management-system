/* ============================================================
   Kamkhadze PA — Case Manager v2 Patch
   Fixes: Zoom client search, timezone search, Dropbox file
   preview/open, enhanced Dropbox features, Excel import,
   email-ready backend hooks, grammar & stability throughout.
   Load AFTER case-manager.js
   ============================================================ */

// ================================================================
// ---- FULL WORLD TIMEZONE DATABASE (searchable) ----
// ================================================================
const ALL_TIMEZONES = [
  // Americas
  { label: 'Honolulu, Hawaii (HST −10:00)',        tz: 'Pacific/Honolulu',        region: 'Americas' },
  { label: 'Anchorage, Alaska (AKST −9:00)',        tz: 'America/Anchorage',       region: 'Americas' },
  { label: 'Los Angeles / Seattle (PST −8:00)',     tz: 'America/Los_Angeles',     region: 'Americas' },
  { label: 'Denver / Phoenix (MST −7:00)',          tz: 'America/Denver',          region: 'Americas' },
  { label: 'Chicago / Dallas (CST −6:00)',          tz: 'America/Chicago',         region: 'Americas' },
  { label: 'New York / Miami (EST −5:00)',          tz: 'America/New_York',        region: 'Americas' },
  { label: 'Bogotá / Lima (COT −5:00)',             tz: 'America/Bogota',          region: 'Americas' },
  { label: 'Caracas (VET −4:00)',                   tz: 'America/Caracas',         region: 'Americas' },
  { label: 'Santiago (CLT −4:00)',                  tz: 'America/Santiago',        region: 'Americas' },
  { label: 'Buenos Aires (ART −3:00)',              tz: 'America/Argentina/Buenos_Aires', region: 'Americas' },
  { label: 'São Paulo / Brasília (BRT −3:00)',      tz: 'America/Sao_Paulo',       region: 'Americas' },
  { label: 'Toronto / Ottawa (EST −5:00)',          tz: 'America/Toronto',         region: 'Americas' },
  { label: 'Vancouver (PST −8:00)',                 tz: 'America/Vancouver',       region: 'Americas' },
  { label: 'Mexico City (CST −6:00)',               tz: 'America/Mexico_City',     region: 'Americas' },
  { label: 'Havana (CST −5:00)',                    tz: 'America/Havana',          region: 'Americas' },
  { label: 'Panama (EST −5:00)',                    tz: 'America/Panama',          region: 'Americas' },
  // Europe
  { label: 'London / Dublin (GMT/BST ±0)',          tz: 'Europe/London',           region: 'Europe' },
  { label: 'Lisbon (WET ±0/+1)',                    tz: 'Europe/Lisbon',           region: 'Europe' },
  { label: 'Paris / Berlin / Rome (CET +1)',        tz: 'Europe/Paris',            region: 'Europe' },
  { label: 'Madrid / Barcelona (CET +1)',           tz: 'Europe/Madrid',           region: 'Europe' },
  { label: 'Amsterdam / Brussels (CET +1)',         tz: 'Europe/Amsterdam',        region: 'Europe' },
  { label: 'Vienna / Prague / Warsaw (CET +1)',     tz: 'Europe/Vienna',           region: 'Europe' },
  { label: 'Stockholm / Oslo / Copenhagen (CET +1)',tz: 'Europe/Stockholm',        region: 'Europe' },
  { label: 'Zürich / Geneva (CET +1)',              tz: 'Europe/Zurich',           region: 'Europe' },
  { label: 'Athens / Helsinki / Kyiv (EET +2)',     tz: 'Europe/Athens',           region: 'Europe' },
  { label: 'Bucharest / Sofia (EET +2)',            tz: 'Europe/Bucharest',        region: 'Europe' },
  { label: 'Istanbul (TRT +3)',                     tz: 'Europe/Istanbul',         region: 'Europe' },
  { label: 'Moscow / St Petersburg (MSK +3)',       tz: 'Europe/Moscow',           region: 'Europe' },
  { label: 'Tbilisi, Georgia (GET +4)',             tz: 'Asia/Tbilisi',            region: 'Europe' },
  { label: 'Yerevan, Armenia (AMT +4)',             tz: 'Asia/Yerevan',            region: 'Europe' },
  { label: 'Baku, Azerbaijan (AZT +4)',             tz: 'Asia/Baku',               region: 'Europe' },
  { label: 'Minsk, Belarus (FET +3)',               tz: 'Europe/Minsk',            region: 'Europe' },
  { label: 'Kyiv, Ukraine (EET +2)',                tz: 'Europe/Kiev',             region: 'Europe' },
  { label: 'Riga / Tallinn / Vilnius (EET +2)',     tz: 'Europe/Riga',             region: 'Europe' },
  { label: 'Warsaw, Poland (CET +1)',               tz: 'Europe/Warsaw',           region: 'Europe' },
  { label: 'Budapest, Hungary (CET +1)',            tz: 'Europe/Budapest',         region: 'Europe' },
  { label: 'Belgrade / Zagreb (CET +1)',            tz: 'Europe/Belgrade',         region: 'Europe' },
  // Middle East & Africa
  { label: 'Dubai / Abu Dhabi (GST +4)',            tz: 'Asia/Dubai',              region: 'Middle East & Africa' },
  { label: 'Riyadh / Jeddah (AST +3)',              tz: 'Asia/Riyadh',             region: 'Middle East & Africa' },
  { label: 'Tehran (IRST +3:30)',                   tz: 'Asia/Tehran',             region: 'Middle East & Africa' },
  { label: 'Doha, Qatar (AST +3)',                  tz: 'Asia/Qatar',              region: 'Middle East & Africa' },
  { label: 'Kuwait City (AST +3)',                  tz: 'Asia/Kuwait',             region: 'Middle East & Africa' },
  { label: 'Amman, Jordan (EET +2)',                tz: 'Asia/Amman',              region: 'Middle East & Africa' },
  { label: 'Jerusalem / Tel Aviv (IST +2)',         tz: 'Asia/Jerusalem',          region: 'Middle East & Africa' },
  { label: 'Cairo, Egypt (EET +2)',                 tz: 'Africa/Cairo',            region: 'Middle East & Africa' },
  { label: 'Nairobi, Kenya (EAT +3)',               tz: 'Africa/Nairobi',          region: 'Middle East & Africa' },
  { label: 'Lagos, Nigeria (WAT +1)',               tz: 'Africa/Lagos',            region: 'Middle East & Africa' },
  { label: 'Casablanca (WET +1)',                   tz: 'Africa/Casablanca',       region: 'Middle East & Africa' },
  { label: 'Johannesburg (SAST +2)',                tz: 'Africa/Johannesburg',     region: 'Middle East & Africa' },
  { label: 'Addis Ababa (EAT +3)',                  tz: 'Africa/Addis_Ababa',      region: 'Middle East & Africa' },
  { label: 'Accra, Ghana (GMT ±0)',                 tz: 'Africa/Accra',            region: 'Middle East & Africa' },
  // Asia & Pacific
  { label: 'Karachi, Pakistan (PKT +5)',            tz: 'Asia/Karachi',            region: 'Asia & Pacific' },
  { label: 'Tashkent, Uzbekistan (UZT +5)',         tz: 'Asia/Tashkent',           region: 'Asia & Pacific' },
  { label: 'Mumbai / Delhi (IST +5:30)',            tz: 'Asia/Kolkata',            region: 'Asia & Pacific' },
  { label: 'Colombo, Sri Lanka (SLST +5:30)',       tz: 'Asia/Colombo',            region: 'Asia & Pacific' },
  { label: 'Kathmandu, Nepal (NPT +5:45)',          tz: 'Asia/Kathmandu',          region: 'Asia & Pacific' },
  { label: 'Dhaka, Bangladesh (BST +6)',            tz: 'Asia/Dhaka',              region: 'Asia & Pacific' },
  { label: 'Yangon, Myanmar (MMT +6:30)',           tz: 'Asia/Rangoon',            region: 'Asia & Pacific' },
  { label: 'Bangkok / Jakarta (ICT/WIB +7)',        tz: 'Asia/Bangkok',            region: 'Asia & Pacific' },
  { label: 'Almaty, Kazakhstan (ALMT +6)',          tz: 'Asia/Almaty',             region: 'Asia & Pacific' },
  { label: 'Kuala Lumpur / Singapore (SGT +8)',     tz: 'Asia/Singapore',          region: 'Asia & Pacific' },
  { label: 'Beijing / Shanghai (CST +8)',           tz: 'Asia/Shanghai',           region: 'Asia & Pacific' },
  { label: 'Hong Kong (HKT +8)',                    tz: 'Asia/Hong_Kong',          region: 'Asia & Pacific' },
  { label: 'Taipei, Taiwan (CST +8)',               tz: 'Asia/Taipei',             region: 'Asia & Pacific' },
  { label: 'Manila, Philippines (PHT +8)',          tz: 'Asia/Manila',             region: 'Asia & Pacific' },
  { label: 'Seoul, South Korea (KST +9)',           tz: 'Asia/Seoul',              region: 'Asia & Pacific' },
  { label: 'Tokyo, Japan (JST +9)',                 tz: 'Asia/Tokyo',              region: 'Asia & Pacific' },
  { label: 'Ulaanbaatar, Mongolia (ULAT +8)',       tz: 'Asia/Ulaanbaatar',        region: 'Asia & Pacific' },
  { label: 'Sydney / Melbourne (AEST +10)',         tz: 'Australia/Sydney',        region: 'Asia & Pacific' },
  { label: 'Brisbane, Queensland (AEST +10)',       tz: 'Australia/Brisbane',      region: 'Asia & Pacific' },
  { label: 'Adelaide (ACST +9:30)',                 tz: 'Australia/Adelaide',      region: 'Asia & Pacific' },
  { label: 'Perth (AWST +8)',                       tz: 'Australia/Perth',         region: 'Asia & Pacific' },
  { label: 'Auckland, New Zealand (NZST +12)',      tz: 'Pacific/Auckland',        region: 'Asia & Pacific' },
  { label: 'Fiji (FJT +12)',                        tz: 'Pacific/Fiji',            region: 'Asia & Pacific' },
];

// Keep the TIMEZONES variable for backward compat
if (typeof TIMEZONES === 'undefined') {
  window.TIMEZONES = ALL_TIMEZONES;
} else {
  // Replace with full list
  TIMEZONES.length = 0;
  ALL_TIMEZONES.forEach(tz => TIMEZONES.push(tz));
}

// ================================================================
// ---- ZOOM: Complete rewrite — robust client search & tz filter ----
// ================================================================

// Timezone filter state
if (!State.zoom.tzSearch) State.zoom.tzSearch = '';
if (!State.zoom.timezone) State.zoom.timezone = 'America/New_York';

function _zoomGetLocalTime(tz) {
  try {
    return new Date().toLocaleTimeString('en-US', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: true
    });
  } catch(e) { return ''; }
}

// Called by the timezone search input
function zoomTzSearch(val) {
  State.zoom.tzSearch = val;
  const filtered = _getFilteredTimezones();
  const listEl = document.getElementById('zoom-tz-list');
  if (!listEl) return;
  listEl.innerHTML = _renderTzOptions(filtered);
}

function _getFilteredTimezones() {
  const q = (State.zoom.tzSearch || '').toLowerCase().trim();
  if (!q) return ALL_TIMEZONES;
  return ALL_TIMEZONES.filter(tz =>
    tz.label.toLowerCase().includes(q) ||
    tz.tz.toLowerCase().includes(q) ||
    tz.region.toLowerCase().includes(q)
  );
}

function _renderTzOptions(list) {
  if (!list.length) return `<div style="padding:10px 14px;font-size:13px;color:var(--text-3);">No timezones found</div>`;
  let html = '';
  let lastRegion = '';
  list.forEach(tz => {
    if (tz.region !== lastRegion) {
      lastRegion = tz.region;
      html += `<div style="padding:6px 14px 2px;font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3);background:var(--bg-2);">${escHtml(tz.region)}</div>`;
    }
    const selected = State.zoom.timezone === tz.tz;
    const localTime = _zoomGetLocalTime(tz.tz);
    html += `<div onmousedown="zoomSelectTimezone('${tz.tz}')"
      style="padding:8px 14px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;font-size:12px;
             background:${selected ? 'rgba(201,168,76,0.1)' : 'transparent'};
             color:${selected ? 'var(--gold-light)' : 'var(--text-2)'};"
      onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background='${selected ? 'rgba(201,168,76,0.1)' : 'transparent'}'">
      <span>${escHtml(tz.label)}</span>
      <span style="font-size:11px;color:var(--text-3);flex-shrink:0;margin-left:8px;">${localTime}</span>
    </div>`;
  });
  return html;
}

function zoomSelectTimezone(tz) {
  State.zoom.timezone = tz;
  const found = ALL_TIMEZONES.find(t => t.tz === tz);
  const inputEl = document.getElementById('zoom-tz-input');
  if (inputEl) inputEl.value = found ? found.label : tz;
  const listEl = document.getElementById('zoom-tz-dropdown');
  if (listEl) listEl.style.display = 'none';
  const selectedEl = document.getElementById('zoom-tz-selected');
  if (selectedEl) selectedEl.innerHTML = `<span style="font-size:12px;color:var(--green);">✓ ${escHtml(found ? found.label : tz)} — <em>${_zoomGetLocalTime(tz)}</em></span>`;
}

function zoomTzFocus() {
  const listEl = document.getElementById('zoom-tz-dropdown');
  if (listEl) {
    listEl.style.display = 'block';
    const items = document.getElementById('zoom-tz-list');
    if (items) items.innerHTML = _renderTzOptions(_getFilteredTimezones());
  }
}

function zoomTzBlur() {
  setTimeout(() => {
    const listEl = document.getElementById('zoom-tz-dropdown');
    if (listEl) listEl.style.display = 'none';
  }, 200);
}

// ---- Render timezone picker widget ----
function _renderTzPicker() {
  const found = ALL_TIMEZONES.find(t => t.tz === State.zoom.timezone);
  return `
    <div class="field">
      <label>Client's Timezone</label>
      <div style="position:relative;">
        <div style="display:flex;align-items:center;background:var(--surface-2);border:1px solid var(--border-2);border-radius:var(--radius,6px);overflow:hidden;transition:border-color .15s;"
          onfocusin="this.style.borderColor='var(--gold)'" onfocusout="this.style.borderColor='var(--border-2)'">
          <span style="padding:0 10px;color:var(--text-3);font-size:13px;">🌐</span>
          <input id="zoom-tz-input" type="text"
            placeholder="Search country or timezone…"
            value="${escAttr(found ? found.label : State.zoom.timezone)}"
            oninput="zoomTzSearch(this.value)"
            onfocus="zoomTzFocus()"
            onblur="zoomTzBlur()"
            autocomplete="off"
            style="flex:1;background:none;border:none;color:var(--text);font-size:13px;padding:8px 8px 8px 0;outline:none;" />
        </div>
        <div id="zoom-tz-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:200;background:var(--surface);border:1px solid var(--gold);border-radius:6px;overflow:hidden;max-height:240px;overflow-y:auto;margin-top:2px;box-shadow:0 8px 30px rgba(0,0,0,.5);">
          <div id="zoom-tz-list">${_renderTzOptions(ALL_TIMEZONES)}</div>
        </div>
      </div>
      <div id="zoom-tz-selected" style="margin-top:4px;min-height:16px;">${found ? `<span style="font-size:12px;color:var(--green);">✓ ${escHtml(found.label)} — <em>${_zoomGetLocalTime(found.tz)}</em></span>` : ''}</div>
    </div>`;
}

// ---- Override renderZoomMeetings completely ----
renderZoomMeetings = function() {
  const zoomConnected = !!sessionStorage.getItem('km_zoom_token');
  const meetings = State.zoom.meetings;
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const todayMeetings = meetings.filter(m => m.date === todayStr).sort((a,b) => a.time.localeCompare(b.time));
  const upcomingMeetings = meetings.filter(m => m.date > todayStr).sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)).slice(0, 10);
  const pastMeetings = meetings.filter(m => m.date < todayStr).sort((a,b) => b.date.localeCompare(a.date)).slice(0, 5);
  const totalThisWeek = meetings.filter(m => {
    const d = new Date(m.date + 'T12:00:00');
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0,0,0,0);
    const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6);
    return d >= startOfWeek && d <= endOfWeek;
  }).length;
  const nextMeeting = [...todayMeetings, ...upcomingMeetings][0];

  return `
    <div class="topbar">
      <div class="topbar-title">Zoom Meetings</div>
      <div class="topbar-actions">
        ${zoomConnected
          ? `<span style="font-size:12px;color:var(--green);background:var(--green-dim);border:1px solid rgba(74,222,128,0.2);border-radius:20px;padding:4px 12px;margin-right:8px">● Connected</span>`
          : `<span style="font-size:12px;color:var(--text-3);background:var(--surface-2);border:1px solid var(--border-2);border-radius:20px;padding:4px 12px;margin-right:8px">Not connected — <a href="#" onclick="navigate('settings')" style="color:var(--gold)">Settings →</a></span>`}
        <button class="btn btn-gold" onclick="zoomToggleScheduleForm()">
          ${icon('add')} Schedule Meeting
        </button>
      </div>
    </div>
    <div class="content" id="zoom-content">

      ${State.zoom.showScheduleForm ? `
      <div class="panel" style="margin-bottom:24px;border-color:rgba(201,168,76,0.25)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <div class="panel-title" style="margin-bottom:0">${icon('calendar')} Schedule New Zoom Meeting</div>
          <button class="btn btn-ghost btn-sm" onclick="zoomToggleScheduleForm()">✕ Cancel</button>
        </div>
        <div class="two-col" style="gap:20px">
          <div>
            <div class="field">
              <label>Client *</label>
              <div style="position:relative;">
                <div class="search-box" style="margin-bottom:0;"
                  onfocusin="this.style.borderColor='var(--gold)'" onfocusout="this.style.borderColor=''">
                  <span class="search-icon" style="width:14px;height:14px">${svgIcon('cases')}</span>
                  <input type="text"
                    id="zoom-client-input"
                    placeholder="Type a client name to search…"
                    value="${escAttr(State.zoom.scheduleClient
                      ? State.zoom.scheduleClient.firstName + ' ' + State.zoom.scheduleClient.lastName
                      : (State.zoom.clientSearch || ''))}"
                    oninput="_zoomClientInput(this.value)"
                    onfocus="_zoomClientFocus()"
                    onblur="_zoomClientBlur()"
                    autocomplete="off"
                  />
                </div>
                <div id="zoom-suggestions" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:100;background:var(--surface);border:1px solid var(--gold);border-radius:6px;overflow:hidden;max-height:220px;overflow-y:auto;margin-top:2px;box-shadow:0 8px 30px rgba(0,0,0,.5);">
                </div>
              </div>
              <div id="zoom-client-confirm" style="margin-top:4px;min-height:16px;">
                ${State.zoom.scheduleClient ? `<span style="font-size:12px;color:var(--green);">✓ ${escHtml(State.zoom.scheduleClient.firstName+' '+State.zoom.scheduleClient.lastName)} · ${escHtml(State.zoom.scheduleClient.email||'no email on file')}</span>` : ''}
              </div>
            </div>

            <div class="field">
              <label>Linked Case</label>
              <select id="zoom-case-select" onchange="State.zoom.scheduleCase=this.value">
                <option value="">Select case…</option>
                ${State.zoom.scheduleClient
                  ? `<option value="${escAttr(State.zoom.scheduleClient.visaType)}" selected>${escHtml(State.zoom.scheduleClient.visaType)} — ${escHtml(State.zoom.scheduleClient.firstName+' '+State.zoom.scheduleClient.lastName)}</option>`
                  : ''}
              </select>
            </div>

            <div class="field">
              <label>Topic / Agenda</label>
              <input type="text" placeholder="e.g. O-1A initial consultation, document review…"
                value="${escAttr(State.zoom.scheduleTopic || '')}"
                oninput="State.zoom.scheduleTopic=this.value" />
            </div>
          </div>

          <div>
            <div class="field">
              <label>Date *</label>
              <input type="date" id="zoom-date-input" value="${escAttr(State.zoom.scheduleDate || '')}" min="${todayStr}"
                onchange="State.zoom.scheduleDate=this.value" />
            </div>

            <div class="field">
              <label>Time</label>
              <input type="time" value="${escAttr(State.zoom.scheduleTime || '10:00')}"
                onchange="State.zoom.scheduleTime=this.value" />
            </div>

            <div class="field">
              <label>Duration</label>
              <select onchange="State.zoom.scheduleDuration=this.value">
                ${['15','30','45','60','90','120'].map(d => `<option value="${d}" ${(State.zoom.scheduleDuration||'45')===d?'selected':''}>${d} minutes</option>`).join('')}
              </select>
            </div>

            ${_renderTzPicker()}

            <div style="margin-top:16px;display:flex;gap:8px">
              <button class="btn btn-gold" style="flex:1;justify-content:center" onclick="zoomCreateMeeting()">
                ${icon('calendar')} Create Meeting
              </button>
            </div>
            <p style="font-size:11px;color:var(--text-3);margin-top:8px;line-height:1.5">
              ${zoomConnected
                ? 'A Zoom link will be generated and the client can be sent an invitation.'
                : '⚠ Zoom is not connected. The meeting will be saved without a link. Connect Zoom in Settings to generate real links.'}
            </p>
          </div>
        </div>
      </div>` : ''}

      <div class="stats-grid" style="margin-bottom:24px">
        <div class="stat-card">
          <div class="stat-card-label">Today</div>
          <div class="stat-card-value" style="color:var(--blue)">${todayMeetings.length}</div>
          <div class="stat-card-sub">meetings scheduled</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">This Week</div>
          <div class="stat-card-value">${totalThisWeek}</div>
          <div class="stat-card-sub">total meetings</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">Next Meeting</div>
          <div class="stat-card-value" style="font-size:15px;color:var(--gold)">${nextMeeting ? nextMeeting.time : '—'}</div>
          <div class="stat-card-sub">${nextMeeting ? escHtml(nextMeeting.clientName) : 'None scheduled'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">Total Scheduled</div>
          <div class="stat-card-value">${meetings.length}</div>
          <div class="stat-card-sub">all time</div>
        </div>
      </div>

      ${todayMeetings.length ? `
      <div class="panel" style="margin-bottom:20px">
        <div class="panel-title" style="margin-bottom:16px">${icon('calendar')} Today — ${new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</div>
        ${todayMeetings.map(m => _zoomMeetingRow(m, now)).join('')}
      </div>` : `
      <div class="panel" style="margin-bottom:20px">
        <div style="padding:20px 0;text-align:center;color:var(--text-3);font-size:14px">No meetings scheduled for today.</div>
      </div>`}

      ${upcomingMeetings.length ? `
      <div class="panel" style="margin-bottom:20px">
        <div class="panel-title" style="margin-bottom:16px">${icon('calendar')} Upcoming</div>
        ${upcomingMeetings.map(m => _zoomMeetingRow(m, now)).join('')}
      </div>` : ''}

      ${pastMeetings.length ? `
      <div class="panel">
        <div class="panel-title" style="margin-bottom:16px">Recent Past Meetings</div>
        ${pastMeetings.map(m => _zoomMeetingRow(m, now)).join('')}
      </div>` : ''}

      ${!meetings.length ? `
      <div class="panel" style="margin-bottom:20px">
        <div class="empty-state" style="padding:50px 20px">
          <div class="empty-state-icon">${svgIcon('calendar')}</div>
          <h3>No meetings yet</h3>
          <p>Schedule your first Zoom meeting using the button above.</p>
          <button class="btn btn-gold" onclick="zoomToggleScheduleForm()">Schedule a Meeting</button>
        </div>
      </div>` : ''}

    </div>`;
};

function _zoomMeetingRow(m, now) {
  const meetingDateTime = new Date(`${m.date}T${m.time}`);
  const diffMin = (meetingDateTime - now) / 60000;
  let status, statusStyle, actionBtn;
  if (m.date < now.toISOString().split('T')[0]) {
    status = 'Done';
    statusStyle = 'background:var(--surface-3);color:var(--text-3);border:1px solid var(--border-2)';
    actionBtn = m.notes
      ? `<button class="btn btn-ghost btn-sm" onclick="zoomViewNotes('${m.id}')">View Notes</button>`
      : `<button class="btn btn-ghost btn-sm" onclick="zoomAddNotes('${m.id}')">Add Notes</button>`;
  } else if (diffMin >= 0 && diffMin <= 30) {
    status = '● Live Now';
    statusStyle = 'background:var(--green-dim);color:var(--green);border:1px solid rgba(74,222,128,0.2)';
    actionBtn = m.zoomLink
      ? `<a href="${escAttr(m.zoomLink)}" target="_blank" class="btn btn-gold btn-sm">${icon('calendar')} Join</a>`
      : `<button class="btn btn-gold btn-sm">Join</button>`;
  } else {
    status = 'Upcoming';
    statusStyle = 'background:var(--blue-dim);color:var(--blue);border:1px solid rgba(96,165,250,0.2)';
    actionBtn = m.zoomLink
      ? `<button class="btn btn-ghost btn-sm" onclick="zoomCopyLink('${m.id}')">Copy Link</button>`
      : `<button class="btn btn-ghost btn-sm" style="color:var(--yellow)">Pending Link</button>`;
  }
  const initials = (m.clientName || '??').split(' ').map(n=>n[0]||'').join('').slice(0,2).toUpperCase();
  const dateLabel = m.date === now.toISOString().split('T')[0] ? 'Today' : fmtDate(m.date);
  const tzLabel = m.timezone ? (() => { const f = ALL_TIMEZONES.find(t=>t.tz===m.timezone); return f ? ` · ${f.label.split('(')[1]?.replace(')','') || ''}` : ''; })() : '';
  return `
    <div style="display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid var(--border-2)">
      <div style="width:34px;height:34px;border-radius:50%;background:var(--gold-dim);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:var(--gold);flex-shrink:0">${escHtml(initials)}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13.5px;font-weight:500;color:var(--text)">${escHtml(m.clientName||'—')}</div>
        <div style="font-size:12px;color:var(--text-3);margin-top:2px">${escHtml(dateLabel)} · ${escHtml(m.time||'')} · ${escHtml(m.duration||'45')} min${tzLabel}${m.topic ? ' · ' + escHtml(m.topic) : ''}</div>
        ${m.caseLabel ? `<div style="font-size:11px;color:var(--text-3);margin-top:1px">${escHtml(m.caseLabel)}</div>` : ''}
      </div>
      <span style="font-size:11px;padding:3px 10px;border-radius:10px;font-weight:500;flex-shrink:0;white-space:nowrap;${statusStyle}">${status}</span>
      <div style="display:flex;gap:6px;flex-shrink:0">
        ${actionBtn}
        <button class="btn btn-ghost btn-sm" onclick="zoomSendReminder('${m.id}')" title="Send reminder email">✉</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="zoomDeleteMeeting('${m.id}')" title="Delete meeting">×</button>
      </div>
    </div>`;
}

// Override rerenderZoom — focus-preserving
rerenderZoom = function() {
  const main = document.getElementById('main-content');
  if (!main) return;
  const activeEl = document.activeElement;
  const wasClientFocused = activeEl && activeEl.id === 'zoom-client-input';
  const wasTzFocused = activeEl && activeEl.id === 'zoom-tz-input';
  main.innerHTML = renderZoomMeetings();
  if (wasClientFocused) {
    const el = document.getElementById('zoom-client-input');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  }
  if (wasTzFocused) {
    const el = document.getElementById('zoom-tz-input');
    if (el) { el.focus(); zoomTzFocus(); }
  }
};

// Override zoomToggleScheduleForm
zoomToggleScheduleForm = function() {
  State.zoom.showScheduleForm = !State.zoom.showScheduleForm;
  if (State.zoom.showScheduleForm) {
    State.zoom.clientSearch = '';
    State.zoom.scheduleClient = null;
    State.zoom.scheduleTopic = '';
    State.zoom.scheduleDate = '';
    State.zoom.scheduleTime = '10:00';
    State.zoom.scheduleDuration = '45';
    State.zoom.tzSearch = '';
  }
  rerenderZoom();
  if (State.zoom.showScheduleForm) {
    setTimeout(() => {
      const el = document.getElementById('zoom-client-input');
      if (el) el.focus();
    }, 80);
  }
};

// Client search — pure DOM, no full rerender
function _zoomClientInput(val) {
  State.zoom.clientSearch = val;
  State.zoom.scheduleClient = null;
  const confirmEl = document.getElementById('zoom-client-confirm');
  if (confirmEl) confirmEl.innerHTML = '';
  _zoomUpdateSuggestions(val);
}

function _zoomClientFocus() {
  const val = State.zoom.clientSearch || '';
  if (!State.zoom.scheduleClient) _zoomUpdateSuggestions(val);
}

function _zoomClientBlur() {
  setTimeout(() => {
    const box = document.getElementById('zoom-suggestions');
    if (box) box.style.display = 'none';
  }, 200);
}

function _zoomUpdateSuggestions(val) {
  const box = document.getElementById('zoom-suggestions');
  if (!box) return;
  const q = (val || '').toLowerCase().trim();
  if (!q) { box.style.display = 'none'; return; }
  const matches = State.cases.filter(c =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
    (c.email || '').toLowerCase().includes(q) ||
    (c.visaType || '').toLowerCase().includes(q)
  ).slice(0, 8);
  if (!matches.length) {
    box.innerHTML = `<div style="padding:12px 14px;font-size:13px;color:var(--text-3);">No clients found for "${escHtml(val)}"</div>`;
    box.style.display = 'block';
    return;
  }
  box.innerHTML = matches.map(c => {
    const name = c.firstName + ' ' + c.lastName;
    const initials = ((c.firstName[0]||'') + (c.lastName[0]||'')).toUpperCase();
    const hl = _highlightMatch(name, q);
    return `<div onmousedown="zoomSelectClientFromSearch('${c.id}')"
      style="padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;font-size:13px;color:var(--text-2);"
      onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background=''">
      <div style="width:30px;height:30px;border-radius:50%;background:var(--gold-dim);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:var(--gold);flex-shrink:0;">${escHtml(initials)}</div>
      <div>
        <div style="color:var(--text);">${hl}</div>
        <div style="font-size:11px;color:var(--text-3);">${escHtml(c.visaType||'')} · ${escHtml(c.stage||'')} · ${escHtml(c.email||'no email')}</div>
      </div>
    </div>`;
  }).join('');
  box.style.display = 'block';
}

function _highlightMatch(str, query) {
  if (!query) return escHtml(str);
  const idx = str.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return escHtml(str);
  return escHtml(str.slice(0, idx))
    + `<span style="color:var(--gold);font-weight:600;">${escHtml(str.slice(idx, idx + query.length))}</span>`
    + escHtml(str.slice(idx + query.length));
}

// Override zoomSelectClientFromSearch
zoomSelectClientFromSearch = function(caseId) {
  const c = State.cases.find(x => x.id === caseId);
  if (!c) return;
  State.zoom.scheduleClient = c;
  State.zoom.clientSearch = `${c.firstName} ${c.lastName}`;
  const inputEl = document.getElementById('zoom-client-input');
  if (inputEl) inputEl.value = State.zoom.clientSearch;
  const box = document.getElementById('zoom-suggestions');
  if (box) box.style.display = 'none';
  const confirmEl = document.getElementById('zoom-client-confirm');
  if (confirmEl) confirmEl.innerHTML = `<span style="font-size:12px;color:var(--green);">✓ ${escHtml(c.firstName+' '+c.lastName)} · ${escHtml(c.email||'no email on file')}</span>`;
  // Update case dropdown
  const sel = document.getElementById('zoom-case-select');
  if (sel) {
    sel.innerHTML = `<option value="">Select case…</option><option value="${escAttr(c.visaType)}" selected>${escHtml(c.visaType)} — ${escHtml(c.firstName+' '+c.lastName)}</option>`;
  }
};

// Override zoomCreateMeeting to save timezone
const _origZoomCreateMeeting = zoomCreateMeeting;
zoomCreateMeeting = function() {
  if (!State.zoom.scheduleClient) { toast('Please select a client first', 'warn'); return; }
  if (!State.zoom.scheduleDate) { toast('Please select a date', 'warn'); return; }
  const c = State.zoom.scheduleClient;
  const conflict = State.zoom.meetings.find(m =>
    m.date === State.zoom.scheduleDate && m.time === State.zoom.scheduleTime
  );
  if (conflict) { toast(`Scheduling conflict: ${conflict.clientName} is already booked at this time`, 'warn'); return; }
  const linkId = Math.random().toString(36).slice(2, 11);
  const zoomConnected = !!sessionStorage.getItem('km_zoom_token');
  const meeting = {
    id: uuid(),
    clientId: c.id,
    clientName: `${c.firstName} ${c.lastName}`,
    clientEmail: c.email || '',
    caseLabel: c.visaType,
    date: State.zoom.scheduleDate,
    time: State.zoom.scheduleTime,
    duration: State.zoom.scheduleDuration || '45',
    topic: State.zoom.scheduleTopic || '',
    timezone: State.zoom.timezone || 'America/New_York',
    zoomLink: zoomConnected ? `https://zoom.us/j/${linkId}` : '',
    status: zoomConnected ? 'confirmed' : 'pending',
    createdAt: new Date().toISOString(),
    notes: '',
  };
  State.zoom.meetings.push(meeting);
  zoomSaveMeetings();
  State.zoom.showScheduleForm = false;
  State.zoom.scheduleClient = null;
  State.zoom.clientSearch = '';
  State.zoom.scheduleTopic = '';
  rerenderZoom();
  toast('Meeting created successfully!');
  if (c.email) {
    setTimeout(() => {
      if (confirm(`Send a Zoom invitation to ${c.email}?`)) zoomSendInvitation(meeting);
    }, 300);
  }
};

// ================================================================
// ---- DROPBOX: Complete overhaul — file preview, open, more ----
// ================================================================

if (!window._dropboxBlobs) window._dropboxBlobs = {};
if (!State.dropbox.viewMode) State.dropbox.viewMode = 'grid'; // grid | list
if (!State.dropbox.sortBy)   State.dropbox.sortBy   = 'date'; // date | name | size | client
if (!State.dropbox.sortDir)  State.dropbox.sortDir  = 'desc';
if (!State.dropbox.filterStatus) State.dropbox.filterStatus = '';

const DROPBOX_FOLDERS_V2 = [
  { id: '01_Personal_Documents',  label: 'Personal Documents',  icon: '🪪' },
  { id: '02_Evidence',            label: 'Evidence',            icon: '🔬' },
  { id: '03_Support_Letters',     label: 'Support Letters',     icon: '✉️' },
  { id: '04_Financial_Documents', label: 'Financial Documents', icon: '💰' },
  { id: '05_Correspondence',      label: 'Correspondence',      icon: '📨' },
  { id: '06_Petition_Drafts',     label: 'Petition Drafts',     icon: '📋' },
  { id: '07_USCIS_Notices',       label: 'USCIS Notices',       icon: '🏛️' },
  { id: '08_Excel_Imports',       label: 'Excel & Spreadsheets',icon: '📊' },
  { id: '09_Photos',              label: 'Photos & Media',      icon: '🖼️' },
  { id: '10_Contracts',           label: 'Contracts',           icon: '📜' },
];

// Sync DROPBOX_FOLDERS for backward compat
if (typeof DROPBOX_FOLDERS !== 'undefined') {
  DROPBOX_FOLDERS.length = 0;
  DROPBOX_FOLDERS_V2.forEach(f => DROPBOX_FOLDERS.push(f.id));
}

function _dbxFileTypeIcon(name, type) {
  const ext = (name || '').split('.').pop().toLowerCase();
  if (ext === 'pdf') return { icon: '📄', color: '#e74c3c', label: 'PDF' };
  if (['doc','docx'].includes(ext)) return { icon: '📝', color: '#2980b9', label: 'Word' };
  if (['xls','xlsx','csv'].includes(ext)) return { icon: '📊', color: '#27ae60', label: 'Excel' };
  if (['ppt','pptx'].includes(ext)) return { icon: '📊', color: '#e67e22', label: 'PowerPoint' };
  if (['jpg','jpeg','png','gif','webp','heic'].includes(ext)) return { icon: '🖼️', color: '#8e44ad', label: 'Image' };
  if (['zip','rar','7z'].includes(ext)) return { icon: '🗜️', color: '#7f8c8d', label: 'Archive' };
  if (['mp4','mov','avi','mkv'].includes(ext)) return { icon: '🎥', color: '#c0392b', label: 'Video' };
  if (['mp3','wav','m4a'].includes(ext)) return { icon: '🎵', color: '#2c3e50', label: 'Audio' };
  if (ext === 'txt') return { icon: '📃', color: '#95a5a6', label: 'Text' };
  return { icon: '📎', color: '#bdc3c7', label: 'File' };
}

function _dbxFmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function _dbxSortedFiles(files) {
  const sorted = [...files];
  const dir = State.dropbox.sortDir === 'asc' ? 1 : -1;
  sorted.sort((a, b) => {
    switch (State.dropbox.sortBy) {
      case 'name':   return dir * (a.name||'').localeCompare(b.name||'');
      case 'size':   return dir * ((a.size||0) - (b.size||0));
      case 'client': return dir * (a.clientName||'').localeCompare(b.clientName||'');
      case 'status': return dir * (a.status||'').localeCompare(b.status||'');
      default:       return dir * ((a.uploadedAt||'').localeCompare(b.uploadedAt||''));
    }
  });
  return sorted;
}

function _dbxCanPreview(f) {
  const ext = (f.name || '').split('.').pop().toLowerCase();
  const type = f.type || '';
  return type.startsWith('image/') || ext === 'pdf' || ['jpg','jpeg','png','gif','webp','pdf'].includes(ext);
}

function _dbxPreviewHtml(f) {
  const blobUrl = window._dropboxBlobs[f.id] || f.url;
  if (!blobUrl || (!blobUrl.startsWith('blob:') && !blobUrl.startsWith('http'))) {
    return `<div style="padding:30px;text-align:center;color:var(--text-3);font-size:13px;">
      <div style="font-size:40px;margin-bottom:12px;">📂</div>
      <div>This file was uploaded in a previous session.</div>
      <div style="margin-top:8px;font-size:12px;">Re-upload the file to preview it again.</div>
    </div>`;
  }
  const ext = (f.name || '').split('.').pop().toLowerCase();
  const type = f.type || '';
  if (type.startsWith('image/') || ['jpg','jpeg','png','gif','webp'].includes(ext)) {
    return `<div style="text-align:center;padding:16px;">
      <img src="${escAttr(blobUrl)}" style="max-width:100%;max-height:400px;border-radius:4px;box-shadow:0 4px 20px rgba(0,0,0,.4);" alt="${escAttr(f.name)}" />
    </div>`;
  }
  if (ext === 'pdf' || type === 'application/pdf') {
    return `<iframe src="${escAttr(blobUrl)}" style="width:100%;height:480px;border:none;border-radius:4px;" title="${escAttr(f.name)}"></iframe>`;
  }
  return `<div style="padding:20px;text-align:center;color:var(--text-3);">Preview not available for this file type.</div>`;
}

// Full Dropbox section render
renderDropboxSection = function() {
  const dropboxConnected = !!sessionStorage.getItem('km_dropbox_token');
  const tab = State.dropbox.tab || 'all';
  const q = (State.dropbox.search || '').toLowerCase().trim();
  const files = State.dropbox.files || [];
  const active = (State.dropbox.activeFileId && files.find(f => f.id === State.dropbox.activeFileId)) || null;

  // Group by folder
  const byFolder = {};
  DROPBOX_FOLDERS_V2.forEach(f => { byFolder[f.id] = []; });
  byFolder['Other'] = [];
  files.forEach(f => {
    const key = DROPBOX_FOLDERS_V2.find(fd => fd.id === f.folder) ? f.folder : 'Other';
    byFolder[key].push(f);
  });

  // Filter
  let filtered = files.filter(f => {
    const matchQ = !q || (f.name||'').toLowerCase().includes(q) || (f.folder||'').toLowerCase().includes(q) || (f.clientName||'').toLowerCase().includes(q);
    const matchStatus = !State.dropbox.filterStatus || f.status === State.dropbox.filterStatus;
    return matchQ && matchStatus;
  });
  if (tab.startsWith('folder:')) {
    const folderId = tab.replace('folder:', '');
    filtered = filtered.filter(f => f.folder === folderId || (folderId === 'Other' && !DROPBOX_FOLDERS_V2.find(fd => fd.id === f.folder)));
  }
  const sorted = _dbxSortedFiles(filtered);

  // Stats
  const totalSize = files.reduce((s, f) => s + (f.size || 0), 0);
  const clientCount = new Set(files.map(f => f.clientId).filter(Boolean)).size;

  return `
    <div class="topbar">
      <div class="topbar-title">${icon('dropbox')} Document Vault</div>
      <div class="topbar-actions">
        ${dropboxConnected
          ? `<span style="font-size:12px;color:var(--green);background:var(--green-dim);border:1px solid rgba(74,222,128,0.2);border-radius:20px;padding:4px 12px;">● Dropbox Synced</span>`
          : `<span style="font-size:12px;color:var(--text-3);background:var(--surface-2);border:1px solid var(--border-2);border-radius:20px;padding:4px 12px;">Local storage only — <a href="#" onclick="navigate('settings')" style="color:var(--gold)">Connect Dropbox →</a></span>`}
        <button class="btn btn-ghost btn-sm" onclick="dropboxUpload()">${icon('add')} Upload Files</button>
        <button class="btn btn-ghost btn-sm" onclick="_dbxShowExcelImport()" title="Import Excel spreadsheet">📊 Import Excel</button>
        <input type="file" id="dropbox-file-input" multiple style="display:none" onchange="dropboxHandleUpload(this)" />
      </div>
    </div>

    <div style="display:flex;flex:1;overflow:hidden;min-height:0;">

      <!-- ---- Left Sidebar ---- -->
      <div style="width:220px;border-right:1px solid var(--border-2);display:flex;flex-direction:column;flex-shrink:0;overflow:hidden;">
        <div style="padding:10px 12px;border-bottom:1px solid var(--border-2);">
          <div class="search-box" style="margin-bottom:0;">
            <span class="search-icon" style="width:14px;height:14px;">${svgIcon('docs')}</span>
            <input type="text" id="dropbox-search-input" placeholder="Search files…"
              value="${escAttr(State.dropbox.search || '')}"
              oninput="dropboxSearchInput(this.value)" style="width:100%;" autocomplete="off" />
          </div>
        </div>
        <div style="flex:1;overflow-y:auto;padding:8px 0;">
          <!-- All Files -->
          <button onclick="State.dropbox.tab='all';State.dropbox.activeFileId=null;rerenderDropbox()"
            style="display:flex;align-items:center;justify-content:space-between;width:100%;padding:7px 14px;background:${tab==='all'?'rgba(201,168,76,0.08)':'transparent'};border:none;border-left:3px solid ${tab==='all'?'var(--gold)':'transparent'};cursor:pointer;color:${tab==='all'?'var(--text)':'var(--text-2)'};font-size:13px;text-align:left;">
            <span>📂 All Files</span>
            <span style="font-size:10px;background:var(--surface-2);border:1px solid var(--border-2);border-radius:10px;padding:1px 6px;color:var(--text-3);">${files.length}</span>
          </button>
          <div style="height:1px;background:var(--border-2);margin:6px 0;"></div>
          <div style="font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3);padding:6px 14px 2px;">Folders</div>
          ${DROPBOX_FOLDERS_V2.map(folder => {
            const count = (byFolder[folder.id] || []).length;
            const isActive = tab === 'folder:' + folder.id;
            return `<button onclick="State.dropbox.tab='folder:${folder.id}';State.dropbox.activeFileId=null;rerenderDropbox()"
              style="display:flex;align-items:center;justify-content:space-between;width:100%;padding:6px 14px;background:${isActive?'rgba(201,168,76,0.08)':'transparent'};border:none;border-left:3px solid ${isActive?'var(--gold)':'transparent'};cursor:pointer;color:${isActive?'var(--text)':'var(--text-2)'};font-size:12px;text-align:left;gap:6px;"
              onmouseover="if(${!isActive})this.style.background='var(--surface-2)'" onmouseout="if(${!isActive})this.style.background='transparent'">
              <span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${folder.icon} ${escHtml(folder.label)}</span>
              ${count ? `<span style="font-size:10px;background:var(--surface-2);border:1px solid var(--border-2);border-radius:10px;padding:1px 5px;color:var(--text-3);flex-shrink:0;">${count}</span>` : ''}
            </button>`;
          }).join('')}
          <div style="height:1px;background:var(--border-2);margin:6px 0;"></div>
          <!-- Clients -->
          <div style="font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3);padding:6px 14px 2px;">By Client</div>
          ${[...new Set(files.map(f => f.clientName).filter(Boolean))].slice(0, 10).map(name => `
            <button onclick="State.dropbox.search='${escAttr(name)}';State.dropbox.tab='all';dropboxSearchInput('${escAttr(name)}')"
              style="display:flex;align-items:center;width:100%;padding:5px 14px;background:transparent;border:none;cursor:pointer;color:var(--text-3);font-size:12px;text-align:left;"
              onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--text-3)'">
              👤 ${escHtml(name)}
            </button>`).join('')}
          <div style="height:1px;background:var(--border-2);margin:6px 0;"></div>
          <!-- Stats -->
          <div style="padding:8px 14px;">
            <div style="font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3);margin-bottom:6px;">Vault Stats</div>
            <div style="font-size:11px;color:var(--text-3);line-height:1.8;">
              <div>${files.length} files · ${_dbxFmtSize(totalSize)}</div>
              <div>${clientCount} client${clientCount !== 1 ? 's' : ''}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ---- Main Area ---- -->
      <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;">

        ${active ? `
        <!-- File Detail View -->
        <div style="flex:1;overflow-y:auto;display:flex;flex-direction:column;">
          <div style="padding:16px 20px;border-bottom:1px solid var(--border-2);display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex-shrink:0;">
            <button class="btn btn-ghost btn-sm" onclick="State.dropbox.activeFileId=null;rerenderDropbox()">← Back</button>
            <button class="btn btn-gold btn-sm" onclick="dropboxOpenFile('${active.id}')">${icon('dropbox')} Open File</button>
            ${_dbxCanPreview(active) ? `<button class="btn btn-ghost btn-sm" onclick="_dbxTogglePreview('${active.id}')">👁 Preview</button>` : ''}
            <button class="btn btn-ghost btn-sm" onclick="dropboxSendByEmail('${active.id}')">${icon('email')} Email to Client</button>
            <button class="btn btn-ghost btn-sm" onclick="_dbxDownloadFile('${active.id}')">${icon('docs')} Download</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--red);margin-left:auto;" onclick="dropboxDeleteFile('${active.id}')">${icon('trash')} Delete</button>
          </div>
          <div style="padding:20px;flex:1;overflow-y:auto;">
            <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:20px;">
              <div style="font-size:40px;flex-shrink:0;">${_dbxFileTypeIcon(active.name, active.type).icon}</div>
              <div style="flex:1;min-width:0;">
                <div style="font-family:var(--font-serif);font-size:20px;font-weight:500;color:var(--gold-light);margin-bottom:4px;word-break:break-word;">${escHtml(active.name)}</div>
                <div style="font-size:12px;color:var(--text-3);line-height:1.8;">
                  <span>${escHtml((DROPBOX_FOLDERS_V2.find(f=>f.id===active.folder)||{label:active.folder||'Uncategorized'}).label)}</span>
                  ${active.clientName ? ` · 👤 ${escHtml(active.clientName)}` : ''}
                  ${active.size ? ` · ${_dbxFmtSize(active.size)}` : ''}
                  · ${fmtDate(active.uploadedAt || active.createdAt)}
                  ${active.uploadedBy ? ` · by ${escHtml(active.uploadedBy)}` : ''}
                </div>
              </div>
            </div>

            <!-- Preview area -->
            <div id="dbx-preview-area-${active.id}" style="display:none;margin-bottom:20px;background:var(--surface-2);border:1px solid var(--border-2);border-radius:8px;overflow:hidden;">
              ${_dbxPreviewHtml(active)}
            </div>

            <div class="two-col" style="gap:16px;">
              <div>
                <div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);margin-bottom:8px;">Status</div>
                <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;">
                  ${['Uploaded','Under Review','Approved','Missing','Archived'].map(s => `
                    <button onclick="dropboxSetStatus('${active.id}','${s}')"
                      style="font-size:12px;padding:5px 12px;border-radius:20px;cursor:pointer;border:1px solid ${active.status===s?'var(--gold)':'var(--border-2)'};background:${active.status===s?'var(--gold-dim)':'transparent'};color:${active.status===s?'var(--gold-light)':'var(--text-3)'};">
                      ${s}
                    </button>`).join('')}
                </div>
                <div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);margin-bottom:8px;">Move to Folder</div>
                <select onchange="dropboxMoveFile('${active.id}',this.value)"
                  style="width:100%;background:var(--surface-2);border:1px solid var(--border-2);border-radius:var(--radius,6px);color:var(--text-2);font-size:12px;padding:7px 10px;outline:none;">
                  <option value="">Select folder…</option>
                  ${DROPBOX_FOLDERS_V2.map(f => `<option value="${escAttr(f.id)}" ${active.folder===f.id?'selected':''}>${f.icon} ${escHtml(f.label)}</option>`).join('')}
                </select>
                ${active.clientName ? '' : `
                <div style="margin-top:12px;">
                  <div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);margin-bottom:8px;">Link to Client</div>
                  <select onchange="_dbxLinkClient('${active.id}',this.value)"
                    style="width:100%;background:var(--surface-2);border:1px solid var(--border-2);border-radius:var(--radius,6px);color:var(--text-2);font-size:12px;padding:7px 10px;outline:none;">
                    <option value="">— Select client —</option>
                    ${State.cases.map(c => `<option value="${c.id}">${escHtml(c.firstName+' '+c.lastName)} · ${escHtml(c.visaType)}</option>`).join('')}
                  </select>
                </div>`}
              </div>
              <div>
                <div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);margin-bottom:8px;">Notes</div>
                <textarea id="dnote-${active.id}" rows="6"
                  style="width:100%;background:var(--surface-2);border:1px solid var(--border-2);border-radius:var(--radius,6px);color:var(--text-2);font-size:12px;padding:10px;outline:none;resize:vertical;line-height:1.6;font-family:var(--font-sans,inherit);"
                  placeholder="Add notes about this document…"
                  onblur="dropboxSaveNote('${active.id}',this.value)"
                >${escHtml(State.dropbox.notes[active.id]||'')}</textarea>
                <button class="btn btn-ghost btn-sm" style="margin-top:6px;width:100%;justify-content:center;"
                  onclick="dropboxSaveNote('${active.id}',document.getElementById('dnote-${active.id}').value);toast('Note saved')">
                  Save Note
                </button>
              </div>
            </div>
          </div>
        </div>` : `

        <!-- File Grid / List View -->
        <div style="padding:10px 16px;border-bottom:1px solid var(--border-2);display:flex;align-items:center;gap:8px;flex-shrink:0;flex-wrap:wrap;">
          <div style="font-size:13px;color:var(--text-3);">
            ${sorted.length} file${sorted.length !== 1 ? 's' : ''}${q ? ` matching "${escHtml(q)}"` : ''}
          </div>
          <div style="margin-left:auto;display:flex;align-items:center;gap:8px;">
            <!-- Status filter -->
            <select onchange="State.dropbox.filterStatus=this.value;rerenderDropbox()"
              style="background:var(--surface-2);border:1px solid var(--border-2);border-radius:var(--radius,6px);color:var(--text-2);font-size:12px;padding:5px 8px;outline:none;">
              <option value="" ${!State.dropbox.filterStatus?'selected':''}>All statuses</option>
              ${['Uploaded','Under Review','Approved','Missing','Archived'].map(s =>
                `<option value="${s}" ${State.dropbox.filterStatus===s?'selected':''}>${s}</option>`).join('')}
            </select>
            <!-- Sort -->
            <select onchange="_dbxSetSort(this.value)"
              style="background:var(--surface-2);border:1px solid var(--border-2);border-radius:var(--radius,6px);color:var(--text-2);font-size:12px;padding:5px 8px;outline:none;">
              <option value="date-desc" ${State.dropbox.sortBy==='date'&&State.dropbox.sortDir==='desc'?'selected':''}>Newest first</option>
              <option value="date-asc"  ${State.dropbox.sortBy==='date'&&State.dropbox.sortDir==='asc'?'selected':''}>Oldest first</option>
              <option value="name-asc"  ${State.dropbox.sortBy==='name'&&State.dropbox.sortDir==='asc'?'selected':''}>Name A–Z</option>
              <option value="name-desc" ${State.dropbox.sortBy==='name'&&State.dropbox.sortDir==='desc'?'selected':''}>Name Z–A</option>
              <option value="size-desc" ${State.dropbox.sortBy==='size'&&State.dropbox.sortDir==='desc'?'selected':''}>Largest first</option>
              <option value="client-asc"${State.dropbox.sortBy==='client'&&State.dropbox.sortDir==='asc'?'selected':''}>Client A–Z</option>
            </select>
            <!-- View toggle -->
            <div style="display:flex;border:1px solid var(--border-2);border-radius:var(--radius,6px);overflow:hidden;">
              <button onclick="State.dropbox.viewMode='grid';rerenderDropbox()"
                style="padding:5px 10px;border:none;background:${State.dropbox.viewMode==='grid'?'var(--surface-3)':'var(--surface-2)'};color:${State.dropbox.viewMode==='grid'?'var(--gold)':'var(--text-3)'};cursor:pointer;font-size:14px;">⊞</button>
              <button onclick="State.dropbox.viewMode='list';rerenderDropbox()"
                style="padding:5px 10px;border:none;background:${State.dropbox.viewMode==='list'?'var(--surface-3)':'var(--surface-2)'};color:${State.dropbox.viewMode==='list'?'var(--gold)':'var(--text-3)'};cursor:pointer;font-size:14px;">☰</button>
            </div>
          </div>
        </div>

        <div id="dropbox-file-grid" style="flex:1;overflow-y:auto;padding:16px;">
          ${_renderDropboxFiles(sorted)}
        </div>`}
      </div>

      <!-- ---- Right Panel ---- -->
      ${!active ? `
      <div style="width:210px;border-left:1px solid var(--border-2);display:flex;flex-direction:column;flex-shrink:0;overflow:hidden;">
        <div style="padding:10px 14px;border-bottom:1px solid var(--border-2);">
          <div style="font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3);">Quick Upload</div>
        </div>
        <div style="padding:12px 14px;flex:1;overflow-y:auto;">
          <div onclick="dropboxUpload()"
            style="border:2px dashed var(--border-2);border-radius:8px;padding:20px 10px;text-align:center;cursor:pointer;transition:border-color .15s,background .15s;"
            onmouseover="this.style.borderColor='var(--gold)';this.style.background='var(--gold-dim)'" onmouseout="this.style.borderColor='var(--border-2)';this.style.background='transparent'">
            <div style="font-size:28px;margin-bottom:6px;">📤</div>
            <div style="font-size:12px;color:var(--text-3);line-height:1.6;">Click to upload files or drag & drop</div>
          </div>
          <div style="height:1px;background:var(--border-2);margin:12px 0;"></div>
          <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:center;margin-bottom:8px;" onclick="_dbxShowExcelImport()">📊 Import Excel</button>
          <div style="height:1px;background:var(--border-2);margin:12px 0;"></div>
          <div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);margin-bottom:8px;">Recent Uploads</div>
          ${files.slice(0,5).map(f => `
            <div onclick="State.dropbox.activeFileId='${f.id}';rerenderDropbox()"
              style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.04);"
              onmouseover="this.style.opacity='.8'" onmouseout="this.style.opacity='1'">
              <span style="font-size:18px;flex-shrink:0;">${_dbxFileTypeIcon(f.name,f.type).icon}</span>
              <div style="flex:1;min-width:0;">
                <div style="font-size:12px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(f.name)}</div>
                <div style="font-size:10px;color:var(--text-3);">${fmtDate(f.uploadedAt)}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>` : ''}

    </div>`;
};

function _renderDropboxFiles(files) {
  if (!files.length) return `
    <div class="empty-state">
      <div class="empty-state-icon">${svgIcon('dropbox')}</div>
      <h3>No files found</h3>
      <p>Upload files or adjust your search filters</p>
      <button class="btn btn-gold" onclick="dropboxUpload()">${icon('add')} Upload Files</button>
    </div>`;

  if (State.dropbox.viewMode === 'list') {
    return `<table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="border-bottom:1px solid var(--border-2);">
          <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);">Name</th>
          <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);">Folder</th>
          <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);">Client</th>
          <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);">Status</th>
          <th style="padding:8px 10px;text-align:right;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);">Size</th>
          <th style="padding:8px 10px;text-align:right;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);">Date</th>
          <th style="padding:8px 10px;text-align:right;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);"></th>
        </tr>
      </thead>
      <tbody>
        ${files.map(f => {
          const fi = _dbxFileTypeIcon(f.name, f.type);
          const folderLabel = (DROPBOX_FOLDERS_V2.find(fd => fd.id === f.folder) || {label: f.folder || 'Other'}).label;
          return `<tr onclick="State.dropbox.activeFileId='${f.id}';rerenderDropbox()"
            style="border-bottom:1px solid rgba(255,255,255,0.04);cursor:pointer;"
            onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background=''">
            <td style="padding:9px 10px;display:flex;align-items:center;gap:9px;">
              <span style="font-size:20px;flex-shrink:0;">${fi.icon}</span>
              <span style="color:var(--text);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;">${escHtml(f.name)}</span>
            </td>
            <td style="padding:9px 10px;color:var(--text-3);font-size:12px;white-space:nowrap;">${escHtml(folderLabel)}</td>
            <td style="padding:9px 10px;color:var(--text-3);font-size:12px;white-space:nowrap;">${escHtml(f.clientName||'—')}</td>
            <td style="padding:9px 10px;">
              <span style="font-size:11px;padding:2px 8px;border-radius:8px;background:var(--surface-3);color:var(--text-3);">${escHtml(f.status||'Uploaded')}</span>
            </td>
            <td style="padding:9px 10px;color:var(--text-3);font-size:12px;text-align:right;white-space:nowrap;">${_dbxFmtSize(f.size)}</td>
            <td style="padding:9px 10px;color:var(--text-3);font-size:11px;text-align:right;white-space:nowrap;">${fmtDate(f.uploadedAt)}</td>
            <td style="padding:9px 10px;text-align:right;">
              <button onclick="event.stopPropagation();dropboxOpenFile('${f.id}')" class="btn btn-ghost btn-sm" style="font-size:11px;padding:3px 8px;">Open</button>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
  }

  // Grid view
  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;">
    ${files.map(f => {
      const fi = _dbxFileTypeIcon(f.name, f.type);
      const hasPrev = window._dropboxBlobs[f.id];
      return `<div onclick="State.dropbox.activeFileId='${f.id}';rerenderDropbox()"
        style="background:var(--surface);border:1px solid var(--border-2);border-radius:10px;padding:14px;cursor:pointer;transition:border-color .15s,transform .1s;position:relative;"
        onmouseover="this.style.borderColor='var(--gold)';this.style.transform='translateY(-1px)'"
        onmouseout="this.style.borderColor='var(--border-2)';this.style.transform=''">
        ${hasPrev && ['jpg','jpeg','png','gif','webp'].includes((f.name||'').split('.').pop().toLowerCase()) ? `
          <div style="height:80px;border-radius:6px;overflow:hidden;margin:-14px -14px 10px;background:var(--surface-2);">
            <img src="${escAttr(window._dropboxBlobs[f.id])}" style="width:100%;height:100%;object-fit:cover;" />
          </div>` : `
          <div style="font-size:32px;margin-bottom:10px;line-height:1;">${fi.icon}</div>`}
        <div style="font-size:12px;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px;">${escHtml(f.name)}</div>
        ${f.clientName ? `<div style="font-size:11px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">👤 ${escHtml(f.clientName)}</div>` : ''}
        <div style="font-size:10px;color:var(--text-3);margin-top:3px;">${fmtDate(f.uploadedAt)}</div>
        ${f.status ? `<div style="margin-top:6px;"><span style="font-size:10px;padding:2px 7px;border-radius:8px;background:var(--surface-2);border:1px solid var(--border-2);color:var(--text-3);">${escHtml(f.status)}</span></div>` : ''}
        <button onclick="event.stopPropagation();dropboxOpenFile('${f.id}')"
          style="position:absolute;top:6px;right:6px;background:var(--gold-dim);border:1px solid var(--border);border-radius:4px;color:var(--gold);font-size:10px;padding:2px 7px;cursor:pointer;opacity:0;transition:opacity .15s;"
          onmouseover="this.style.opacity='1'"
          class="dbx-open-btn">Open</button>
      </div>`;
    }).join('')}
  </div>`;
}

function _dbxSetSort(val) {
  const [by, dir] = val.split('-');
  State.dropbox.sortBy = by;
  State.dropbox.sortDir = dir;
  rerenderDropbox();
}

function _dbxTogglePreview(id) {
  const el = document.getElementById(`dbx-preview-area-${id}`);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function _dbxLinkClient(fileId, caseId) {
  const f = State.dropbox.files.find(x => x.id === fileId);
  const c = State.cases.find(x => x.id === caseId);
  if (f && c) {
    f.clientId = c.id;
    f.clientName = `${c.firstName} ${c.lastName}`;
    dropboxSave();
    toast(`Linked to ${c.firstName} ${c.lastName}`);
    rerenderDropbox();
  }
}

function _dbxDownloadFile(id) {
  const f = State.dropbox.files.find(x => x.id === id);
  if (!f) return;
  const blobUrl = window._dropboxBlobs[id] || f.url;
  if (blobUrl && (blobUrl.startsWith('blob:') || blobUrl.startsWith('http'))) {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = f.name;
    a.click();
  } else {
    toast('File is not available for download — please re-upload', 'warn');
  }
}

// Override dropboxOpenFile — open inline for images/PDFs, download for others
dropboxOpenFile = function(id) {
  const f = State.dropbox.files.find(x => x.id === id);
  if (!f) return;
  const blobUrl = window._dropboxBlobs[id] || f.url;
  if (!blobUrl || (!blobUrl.startsWith('blob:') && !blobUrl.startsWith('http'))) {
    toast('File is not available — it was uploaded in a previous session. Please re-upload.', 'warn');
    return;
  }
  const ext = (f.name || '').split('.').pop().toLowerCase();
  const type = f.type || '';
  // Images and PDFs: open in new tab for native browser preview
  if (type.startsWith('image/') || type === 'application/pdf' || ['jpg','jpeg','png','gif','webp','pdf'].includes(ext)) {
    window.open(blobUrl, '_blank');
    return;
  }
  // All other files: trigger download
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = f.name;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

// Override dropboxHandleUpload — robust, with blob storage
dropboxHandleUpload = function(input) {
  if (!input?.files?.length) return;
  const uploadedBy = State.team[0]?.name || 'Ana Kamkhadze';
  Array.from(input.files).forEach(file => {
    const id = uuid();
    const blobUrl = URL.createObjectURL(file);
    window._dropboxBlobs[id] = blobUrl;
    // Auto-detect folder from file type
    const ext = file.name.split('.').pop().toLowerCase();
    let folder = '01_Personal_Documents';
    if (['xlsx','xls','csv'].includes(ext)) folder = '08_Excel_Imports';
    else if (['jpg','jpeg','png','gif','webp','heic'].includes(ext)) folder = '09_Photos';
    else if (['doc','docx'].includes(ext)) folder = '06_Petition_Drafts';
    State.dropbox.files.unshift({
      id,
      name: file.name,
      folder,
      clientName: '',
      clientId: '',
      size: file.size,
      type: file.type,
      status: 'Uploaded',
      url: blobUrl,
      uploadedAt: new Date().toISOString(),
      uploadedBy,
    });
  });
  dropboxSave();
  toast(`${input.files.length} file${input.files.length > 1 ? 's' : ''} uploaded successfully`);
  rerenderDropbox();
  input.value = '';
};

// Override dropboxUpload — show enhanced modal
dropboxUpload = function() {
  showModal(`
    <div class="modal" style="max-width:500px">
      <div class="modal-header">
        <h3>${icon('dropbox')} Upload Files to Document Vault</h3>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label>Uploaded by</label>
          <select id="upload-by-select">
            ${State.team.map(u => `<option value="${escAttr(u.name)}">${escHtml(u.name)} (${escHtml(u.role)})</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Client / Case <span style="color:var(--text-3);font-weight:400;">(optional)</span></label>
          <select id="upload-client-select">
            <option value="">— No specific client —</option>
            ${State.cases.map(c => `<option value="${escAttr(c.id)}">${escHtml(c.firstName+' '+c.lastName)} · ${escHtml(c.visaType)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Folder</label>
          <select id="upload-folder-select">
            ${DROPBOX_FOLDERS_V2.map(f => `<option value="${escAttr(f.id)}">${f.icon} ${escHtml(f.label)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Select files</label>
          <div onclick="document.getElementById('upload-file-input-modal').click()"
            style="border:2px dashed var(--border-2);border-radius:8px;padding:20px;text-align:center;cursor:pointer;transition:border-color .15s,background .15s;"
            onmouseover="this.style.borderColor='var(--gold)';this.style.background='var(--gold-dim)'" onmouseout="this.style.borderColor='var(--border-2)';this.style.background='transparent'">
            <div style="font-size:32px;margin-bottom:6px;">📤</div>
            <div style="font-size:13px;color:var(--text-2);">Click to select files</div>
            <div style="font-size:11px;color:var(--text-3);margin-top:4px;">PDF, Word, Excel, images, and all other formats supported</div>
          </div>
          <input type="file" id="upload-file-input-modal" multiple style="display:none"
            onchange="document.getElementById('upload-file-preview').innerHTML=_dbxPreviewFileList(this.files)" />
          <div id="upload-file-preview" style="margin-top:8px;font-size:12px;color:var(--text-3);"></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-gold" onclick="_dbxDoModalUpload()">${icon('add')} Upload Files</button>
      </div>
    </div>`);
};

function _dbxPreviewFileList(files) {
  if (!files || !files.length) return '';
  return `<div style="display:flex;flex-direction:column;gap:4px;">
    ${Array.from(files).map(f => `
      <div style="display:flex;align-items:center;gap:8px;padding:4px 8px;background:var(--surface-2);border-radius:4px;">
        <span>${_dbxFileTypeIcon(f.name, f.type).icon}</span>
        <span style="flex:1;color:var(--text-2);">${escHtml(f.name)}</span>
        <span style="color:var(--text-3);">${_dbxFmtSize(f.size)}</span>
      </div>`).join('')}
  </div>`;
}

function _dbxDoModalUpload() {
  const input = document.getElementById('upload-file-input-modal');
  if (!input?.files?.length) { toast('Please select at least one file', 'warn'); return; }
  const uploadedBy = document.getElementById('upload-by-select')?.value || State.team[0]?.name || 'Unknown';
  const clientId   = document.getElementById('upload-client-select')?.value || '';
  const folder     = document.getElementById('upload-folder-select')?.value || '01_Personal_Documents';
  const clientCase = clientId ? State.cases.find(c => c.id === clientId) : null;
  Array.from(input.files).forEach(file => {
    const id = uuid();
    const blobUrl = URL.createObjectURL(file);
    window._dropboxBlobs[id] = blobUrl;
    State.dropbox.files.unshift({
      id, name: file.name, folder,
      clientName: clientCase ? `${clientCase.firstName} ${clientCase.lastName}` : '',
      clientId: clientCase?.id || '',
      size: file.size, type: file.type,
      status: 'Uploaded', url: blobUrl,
      uploadedAt: new Date().toISOString(), uploadedBy,
    });
  });
  dropboxSave();
  closeModal();
  toast(`${input.files.length} file${input.files.length > 1 ? 's' : ''} uploaded by ${uploadedBy}`);
  rerenderDropbox();
}

// Override rerenderDropbox — focus-preserving
rerenderDropbox = function() {
  const main = document.getElementById('main-content');
  if (!main) return;
  const activeEl = document.activeElement;
  const wasSearchFocused = activeEl && activeEl.id === 'dropbox-search-input';
  main.innerHTML = renderDropboxSection();
  if (wasSearchFocused) {
    const el = document.getElementById('dropbox-search-input');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  }
};

// Override dropboxSearchInput — fast, no full rerender
dropboxSearchInput = function(val) {
  State.dropbox.search = val;
  const gridEl = document.getElementById('dropbox-file-grid');
  if (!gridEl) { rerenderDropbox(); return; }
  const q = val.toLowerCase().trim();
  let filtered = State.dropbox.files.filter(f => {
    const matchQ = !q || (f.name||'').toLowerCase().includes(q) || (f.folder||'').toLowerCase().includes(q) || (f.clientName||'').toLowerCase().includes(q);
    const matchStatus = !State.dropbox.filterStatus || f.status === State.dropbox.filterStatus;
    return matchQ && matchStatus;
  });
  const tab = State.dropbox.tab;
  if (tab.startsWith('folder:')) {
    const folderId = tab.replace('folder:', '');
    filtered = filtered.filter(f => f.folder === folderId || (folderId === 'Other' && !DROPBOX_FOLDERS_V2.find(fd => fd.id === f.folder)));
  }
  gridEl.innerHTML = _renderDropboxFiles(_dbxSortedFiles(filtered));
};

// ================================================================
// ---- EXCEL IMPORT — smart column mapping ----
// ================================================================

function _dbxShowExcelImport() {
  showModal(`
    <div class="modal modal-lg" style="max-width:700px;">
      <div class="modal-header">
        <h3>📊 Import Excel Spreadsheet</h3>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body" style="overflow-y:auto;max-height:70vh;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
          <div>
            <div style="font-size:13px;font-weight:500;color:var(--text);margin-bottom:8px;">Option 1 — Upload File</div>
            <div onclick="document.getElementById('excel-upload-input').click()"
              style="border:2px dashed var(--border-2);border-radius:8px;padding:24px;text-align:center;cursor:pointer;"
              onmouseover="this.style.borderColor='var(--gold)';this.style.background='var(--gold-dim)'" onmouseout="this.style.borderColor='var(--border-2)';this.style.background='transparent'">
              <div style="font-size:32px;margin-bottom:8px;">📊</div>
              <div style="font-size:13px;color:var(--text-2);">Upload .xlsx, .xls, or .csv</div>
              <div style="font-size:11px;color:var(--text-3);margin-top:4px;">Store the file in the Document Vault</div>
            </div>
            <input type="file" id="excel-upload-input" accept=".xlsx,.xls,.csv" style="display:none"
              onchange="_dbxHandleExcelFile(this)" />
            <div id="excel-upload-status" style="margin-top:8px;font-size:12px;color:var(--green);"></div>
          </div>
          <div>
            <div style="font-size:13px;font-weight:500;color:var(--text);margin-bottom:8px;">Option 2 — Import Cases from Excel</div>
            <p style="font-size:12px;color:var(--text-3);margin-bottom:10px;line-height:1.6;">
              Open your Excel file → Select All (Ctrl+A) → Copy (Ctrl+C) → Paste below to import cases directly.
            </p>
            <p style="font-size:11px;color:var(--gold);margin-bottom:8px;">
              Expected columns: # · Last Name · First Name · Case Type · Filing Date · RA · Receipt · Expiration · Priority Date · Officer
            </p>
            <textarea id="excel-paste-data" rows="8"
              style="width:100%;background:var(--surface-2);border:1px solid var(--border-2);border-radius:6px;color:var(--text-2);font-size:11px;padding:10px;outline:none;font-family:monospace;resize:vertical;"
              placeholder="Paste rows here — header row will be detected and skipped automatically…"
              oninput="_dbxPreviewExcelPaste(this.value)"></textarea>
            <div id="excel-paste-preview" style="font-size:12px;color:var(--text-3);margin-top:4px;"></div>
          </div>
        </div>
        <div style="background:rgba(201,168,76,0.06);border:1px solid rgba(201,168,76,0.15);border-radius:6px;padding:10px 12px;margin-top:16px;font-size:12px;color:var(--text-3);">
          ⚠ All imported case data is encrypted and stored locally. Nothing is transmitted externally.
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-ghost" onclick="_dbxExcelAddToExisting()">Import — Add to Existing Cases</button>
        <button class="btn btn-gold" onclick="_dbxExcelReplaceAll()">Import — Replace All Cases</button>
      </div>
    </div>`);
}

function _dbxHandleExcelFile(input) {
  if (!input?.files?.length) return;
  const file = input.files[0];
  const id = uuid();
  const blobUrl = URL.createObjectURL(file);
  window._dropboxBlobs[id] = blobUrl;
  State.dropbox.files.unshift({
    id, name: file.name, folder: '08_Excel_Imports',
    clientName: '', clientId: '',
    size: file.size, type: file.type,
    status: 'Uploaded', url: blobUrl,
    uploadedAt: new Date().toISOString(),
    uploadedBy: State.team[0]?.name || 'Ana Kamkhadze',
  });
  dropboxSave();
  const statusEl = document.getElementById('excel-upload-status');
  if (statusEl) statusEl.textContent = `✓ "${file.name}" saved to Document Vault → Excel & Spreadsheets`;
}

function _dbxPreviewExcelPaste(val) {
  const rows = _parseImportRows(val);
  const el = document.getElementById('excel-paste-preview');
  if (el) {
    if (!val.trim()) { el.textContent = ''; return; }
    el.textContent = rows.length
      ? `✓ ${rows.length} case row${rows.length > 1 ? 's' : ''} detected and ready to import`
      : '⚠ No valid case rows detected — check your column format';
    el.style.color = rows.length ? 'var(--green)' : 'var(--yellow)';
  }
}

async function _dbxExcelAddToExisting() {
  const val = document.getElementById('excel-paste-data')?.value || '';
  const rows = _parseImportRows(val);
  if (!rows.length) { toast('No valid rows found — paste Excel data first', 'warn'); return; }
  State.cases = [...State.cases, ...rows];
  await Storage.save();
  closeModal();
  toast(`${rows.length} case${rows.length > 1 ? 's' : ''} added successfully`);
  render();
}

async function _dbxExcelReplaceAll() {
  const val = document.getElementById('excel-paste-data')?.value || '';
  const rows = _parseImportRows(val);
  if (!rows.length) { toast('No valid rows found — paste Excel data first', 'warn'); return; }
  if (!confirm(`Replace all ${State.cases.length} existing cases with ${rows.length} imported cases? This cannot be undone.`)) return;
  State.cases = rows;
  await Storage.save();
  closeModal();
  toast(`${rows.length} case${rows.length > 1 ? 's' : ''} imported successfully`);
  render();
}

// ================================================================
// ---- BACKEND INTEGRATION HOOKS (ready for easy backend add) ----
// ================================================================
// Each function is a named hook. When you add a backend, implement
// these in a separate backend-adapter.js file and they will be
// automatically called throughout the application.

window.BackendHooks = {
  // Called when a case is saved. Override to POST to your API.
  onCaseSave: async (cases) => {
    // Example: await fetch('/api/cases', {method:'POST',body:JSON.stringify(cases),headers:{'Content-Type':'application/json'}});
  },
  // Called when an email is sent. Override to relay via your SMTP server.
  onEmailSend: async ({ to, subject, body, caseId }) => {
    // Example: await fetch('/api/email/send', {method:'POST',body:JSON.stringify({to,subject,body,caseId}),headers:{'Content-Type':'application/json'}});
  },
  // Called when a Zoom meeting is created. Override to create via Zoom API.
  onZoomCreate: async (meeting) => {
    // Example: await fetch('/api/zoom/create', {method:'POST',body:JSON.stringify(meeting),headers:{'Content-Type':'application/json'}});
  },
  // Called on user login. Override to validate credentials server-side.
  onLogin: async (username) => {
    // Example: await fetch('/api/auth/login', {method:'POST',body:JSON.stringify({username}),...});
  },
};

// ================================================================
// ---- EMAIL: Patch send to call backend hook ----
// ================================================================
const _origEmailSend = emailSend;
emailSend = async function() {
  const d = State.email.composeData;
  if (!d.to)      { toast('Please enter a recipient', 'warn'); return; }
  if (!d.subject) { toast('Please enter a subject line', 'warn'); return; }
  try {
    await window.BackendHooks.onEmailSend({
      to: d.to, subject: d.subject, body: d.body,
      caseId: State.selectedCaseId || null,
    });
  } catch(e) { /* Backend not configured — continue with mailto fallback */ }
  const sent = {
    id: uuid(), from: 'You → ' + d.to, fromEmail: d.to,
    subject: d.subject, preview: d.body.slice(0, 80), body: d.body,
    time: new Date().toLocaleTimeString('en-US', {hour:'2-digit',minute:'2-digit'}),
    date: 'Today', unread: false,
  };
  State.email.sent.unshift(sent);
  localStorage.setItem('km_email_sent', JSON.stringify(State.email.sent));
  window.open(`mailto:${d.to}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`, '_blank');
  toast('Email sent and logged');
  State.email.tab = 'sent';
  State.email.activeEmailId = sent.id;
  rerenderEmail();
};

// ================================================================
// ---- DRAG & DROP upload support ----
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
  document.body.addEventListener('dragover', (e) => {
    if (State.view === 'dropbox') { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }
  });
  document.body.addEventListener('drop', (e) => {
    if (State.view !== 'dropbox') return;
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files.length) return;
    const fakeInput = { files };
    dropboxHandleUpload(fakeInput);
  });
});

// ================================================================
// ---- PATCH: renderMain & navigate to stay in sync ----
// ================================================================
const _v2_origRenderMain = renderMain;
renderMain = function() {
  if (State.view === 'chat')    return renderChatSection();
  if (State.view === 'dropbox') return renderDropboxSection();
  if (State.view === 'email')   return renderEmailSection();
  if (State.view === 'zoom')    return renderZoomMeetings();
  return _v2_origRenderMain();
};

console.info('[Kamkhadze PA v2] Patch loaded: Zoom fix ✓ Timezone search ✓ Dropbox overhaul ✓ Excel import ✓ Backend hooks ✓');
