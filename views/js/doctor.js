/* doctor.js – Doctor dashboard logic, wired to Go backend */

const isMobile = () => window.innerWidth <= 750;

// ── TIME / DATE HELPERS ───────────────────────────────────────────
function formatTime(t) {
  if (!t) return '-';
  const parts = t.split(':');
  const h = parseInt(parts[0], 10);
  const m = parts[1] || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return h12 + ':' + m + ' ' + ampm;
}

function activityWhen(date, time) {
  const today = new Date().toISOString().split('T')[0];
  const yest  = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const t = formatTime(time);
  if (date === today) return 'Today ' + t;
  if (date === yest)  return 'Yesterday ' + t;
  return (date || '') + ' ' + t;
}

const pageTitles = {
  dashboard: 'Home',
  patients:  'My Patients',
  profile:   'Profile'
};

// ── PAGE SWITCHING ────────────────────────────────────────────────
function showPage(pageId, desktopEl, mobileTitle) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');

  document.querySelectorAll('.desktop-nav-links li').forEach(l => l.classList.remove('active'));
  if (desktopEl && desktopEl.classList) desktopEl.classList.add('active');

  document.querySelectorAll('.bottom-nav ul li').forEach(l => l.classList.remove('active'));
  const b = document.getElementById('bnav-' + pageId);
  if (b) b.classList.add('active');

  document.getElementById('mobilePageTitle').textContent = mobileTitle || pageTitles[pageId] || '';

  const m = isMobile();
  document.querySelectorAll('.desktop-table').forEach(el => el.style.display = m ? 'none' : 'block');
  document.querySelectorAll('.mobile-card-list').forEach(el => el.style.display = m ? 'block' : 'none');
  document.querySelectorAll('.desktop-activity').forEach(el => el.style.display = m ? 'none' : 'block');
  document.querySelectorAll('.mobile-activity').forEach(el => el.style.display = m ? 'block' : 'none');

  if (pageId === 'dashboard') loadDoctorDashboard();
  if (pageId === 'patients')  loadPatients();
  if (pageId === 'profile')   loadDoctorProfile();
}

function showNavHint() {
  if (!isMobile() || sessionStorage.getItem('docHint')) return;
  const h = document.getElementById('navHint');
  if (!h) return;
  h.style.display = 'block';
  sessionStorage.setItem('docHint', '1');
  setTimeout(function() {
    h.style.transition = 'opacity 0.5s';
    h.style.opacity = '0';
    setTimeout(function() { h.style.display = 'none'; }, 500);
  }, 3000);
}

// ── LOGOUT ───────────────────────────────────────────────────────
function confirmLogout() { document.getElementById('logoutOverlay').classList.add('active'); }
function closeLogout()   { document.getElementById('logoutOverlay').classList.remove('active'); }

function doLogout() {
  fetch('/doctor/logout', { method: 'POST' })
    .catch(function() { /* ignore */ })
    .finally(function() {
      closeLogout();
      window.location.href = 'login.html';
    });
}

// ── LOAD DOCTOR DASHBOARD ─────────────────────────────────────────
function loadDoctorDashboard() {
  const chamberId = sessionStorage.getItem('doctorChamber');
  const name      = sessionStorage.getItem('userName') || 'Doctor';

  const wD = document.querySelector('.welcome-desktop h2');
  if (wD) wD.textContent = 'Good morning, ' + name + '!';
  const wM = document.querySelector('.welcome-mobile h2');
  if (wM) wM.textContent = 'Good morning, ' + name.split(' ').slice(-1)[0] + ' 👋';

  if (!chamberId) return;

  loadActivity(chamberId);

  const today = new Date().toISOString().split('T')[0];
  fetch('/doctor/chamber/' + chamberId + '/appointments?date=' + today)
    .then(function(res) {
      if (!res.ok) return;
      return res.json();
    })
    .then(function(apts) {
      apts = apts || [];

      const set = function(sel, val) {
        const el = document.querySelector(sel);
        if (el) el.textContent = val;
      };
      const waiting = apts.filter(function(a) { return a.status !== 'Completed' && a.status !== 'Cancelled'; }).length;
      set('.stat-card.teal h4', apts.length);
      set('.stat-card.blue h4', waiting);

      // Update welcome subtitle lines
      const total = apts.length;
      const countEl = document.getElementById('welcome-patient-count');
      if (countEl) countEl.textContent = total + ' patient' + (total !== 1 ? 's' : '');

      const nextApt = apts.find(function(a) { return a.status !== 'Completed' && a.status !== 'Cancelled'; });
      const nextEl = document.getElementById('welcome-next-apt');
      if (nextEl) {
        if (nextApt) {
          nextEl.innerHTML = '<i class="fas fa-clock"></i> Next: ' + (nextApt.name || 'Patient') +
            ' at ' + (nextApt.apt_time || '-') + ' — Chamber ' + (nextApt.chamber_no || chamberId);
        } else {
          nextEl.innerHTML = '<i class="fas fa-clock"></i> No more appointments for today.';
        }
      }

      const mobileCountEl = document.getElementById('welcome-mobile-count');
      if (mobileCountEl) mobileCountEl.innerHTML = '<i class="fas fa-calendar-alt"></i> ' +
        total + ' patient' + (total !== 1 ? 's' : '') + ' today';

      renderPatientQueue(apts);
    })
    .catch(function(e) {
      console.error('Doctor dashboard error:', e);
    });
}

// ── RENDER PATIENT QUEUE ──────────────────────────────────────────
function renderPatientQueue(apts) {
  const tb = document.querySelector('#dashboard .desktop-table tbody');
  const ml = document.querySelector('#dashboard .mobile-card-list');

  if (!apts || apts.length === 0) {
    if (tb) tb.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:32px">No patients scheduled today</td></tr>';
    if (ml) ml.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:24px 0">No patients today</p>';
    return;
  }

  if (tb) {
    tb.innerHTML = apts.map(function(a, i) {
      const done     = a.status === 'Completed';
      const badgeCls = done ? 'status-seen' : (a.status === 'Cancelled' ? 'status-off' : 'status-waiting');
      const badgeTxt = done ? 'Seen' : (a.status || 'Waiting');
      return '<tr id="prow-' + a.appointment_id + '">' +
        '<td>' + (i + 1) + '</td>' +
        '<td>' + (a.name || '-') + '</td>' +
        '<td>' + (a.cid || '-') + '</td>' +
        '<td>' + (a.apt_time || '-') + '</td>' +
        '<td>' + (a.department || '-') + '</td>' +
        '<td><span class="badge ' + badgeCls + '">' + badgeTxt + '</span></td>' +
        '<td>' +
          '<button class="btn-small btn-view" onclick="viewPatient(\'' + a.cid + '\')">View</button>' +
          (!done
            ? '<button class="btn-small btn-done" onclick="markSeen(' + a.appointment_id + ')">Mark Seen</button>'
            : '<button class="btn-small btn-done" disabled>Done</button>') +
        '</td>' +
        '</tr>';
    }).join('');
  }

  if (ml) {
    ml.innerHTML = apts.map(function(a) {
      const done = a.status === 'Completed';
      return '<div class="note-card" id="mprow-' + a.appointment_id + '">' +
        '<div class="note-card-header">' +
          '<strong>' + (a.name || 'Patient') + '</strong>' +
          '<span class="badge ' + (done ? 'status-seen' : 'status-waiting') + '">' + (done ? 'Seen' : 'Waiting') + '</span>' +
        '</div>' +
        '<p>' + (a.apt_time || '-') + ' · ' + (a.department || '-') + ' · CID ' + (a.cid || '-') + '</p>' +
        (!done ? '<button class="btn-small" style="margin-top:8px" onclick="markSeen(' + a.appointment_id + ')">Mark Seen</button>' : '') +
        '</div>';
    }).join('');
  }
}

// ── MARK PATIENT SEEN ─────────────────────────────────────────────
function markSeen(aptId) {
  fetch('/doctor/appointment/' + aptId + '/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Completed' })
  })
  .then(function(res) {
    if (!res.ok) { alert('Could not update status.'); return; }

    const row = document.getElementById('prow-' + aptId);
    if (row) {
      const badge = row.querySelector('.badge');
      if (badge) { badge.className = 'badge status-seen'; badge.textContent = 'Seen'; }
      const btn = row.querySelector('.btn-done');
      if (btn) { btn.disabled = true; btn.textContent = 'Done'; }
    }
    const mrow = document.getElementById('mprow-' + aptId);
    if (mrow) {
      const badge = mrow.querySelector('.badge');
      if (badge) { badge.className = 'badge status-seen'; badge.textContent = 'Seen'; }
      const btn = mrow.querySelector('button.btn-small');
      if (btn) btn.remove();
    }
  })
  .catch(function() { alert('Network error.'); });
}

// ── VIEW PATIENT (from queue — navigate to patients page) ─────────
function viewPatient(cid) {
  showPage('patients', null, 'My Patients');
}

// ── LOAD PATIENTS ─────────────────────────────────────────────────
function loadPatients() {
  const chamberId = sessionStorage.getItem('doctorChamber');
  if (!chamberId) return;

  fetch('/doctor/chamber/' + chamberId + '/patients')
    .then(function(res) { return res.ok ? res.json() : []; })
    .catch(function() { return []; })
    .then(function(patients) { renderPatients(patients || []); });
}

function renderPatients(patients) {
  const tb = document.querySelector('#patients tbody');
  const ml = document.querySelector('#patients .mobile-card-list');

  if (!patients || patients.length === 0) {
    if (tb) tb.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:32px">No patients found</td></tr>';
    if (ml) ml.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:24px 0">No patients found</p>';
    return;
  }

  if (tb) {
    tb.innerHTML = patients.map(function(p, i) {
      return '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td>' + (p.name || '-') + '</td>' +
        '<td>' + (p.cid || '-') + '</td>' +
        '<td>' + (p.department || '-') + '</td>' +
        '<td>' + (p.last_visit || '-') + '</td>' +
        '<td>' + (p.visit_count || 0) + '</td>' +
        '<td><button class="btn-small btn-view" onclick="openPatientHistory(\'' +
          p.cid.replace(/'/g, '') + '\',\'' + (p.name || '').replace(/'/g, '') + '\')">View History</button></td>' +
        '</tr>';
    }).join('');
  }

  if (ml) {
    ml.innerHTML = patients.map(function(p) {
      return '<div class="note-card">' +
        '<div class="note-card-header">' +
          '<strong>' + (p.name || 'Patient') + '</strong>' +
          '<span class="badge status-on">' + (p.department || '-') + '</span>' +
        '</div>' +
        '<p>CID ' + (p.cid || '-') + ' · Last visit: ' + (p.last_visit || '-') + '</p>' +
        '<button class="btn-small btn-view" style="margin-top:8px;width:100%" onclick="openPatientHistory(\'' +
          p.cid.replace(/'/g, '') + '\',\'' + (p.name || '').replace(/'/g, '') + '\')">View History</button>' +
        '</div>';
    }).join('');
  }
}

// ── PATIENT HISTORY MODAL ─────────────────────────────────────────
function openPatientHistory(cid, name) {
  const chamberId = sessionStorage.getItem('doctorChamber');
  const overlay = document.getElementById('historyOverlay');
  const title   = document.getElementById('historyModalTitle');
  const tbody   = document.getElementById('historyTableBody');

  if (title) title.textContent = (name || 'Patient') + ' — Appointment History';
  if (tbody) tbody.innerHTML   = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px">Loading…</td></tr>';
  if (overlay) overlay.classList.add('active');

  fetch('/doctor/chamber/' + chamberId + '/appointments')
    .then(function(res) { return res.ok ? res.json() : []; })
    .catch(function() { return []; })
    .then(function(apts) {
      const patApts = (apts || []).filter(function(a) { return a.cid === cid; });
      renderHistoryTable(patApts);
    });
}

function renderHistoryTable(apts) {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;

  if (!apts || apts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px">No appointment history found</td></tr>';
    return;
  }

  tbody.innerHTML = apts.map(function(a, i) {
    const done      = a.status === 'Completed';
    const cancelled = a.status === 'Cancelled';
    const badgeCls  = done ? 'status-seen' : (cancelled ? 'status-off' : 'status-waiting');
    return '<tr>' +
      '<td>' + (i + 1) + '</td>' +
      '<td>' + (a.apt_date || '-') + '</td>' +
      '<td>' + formatTime(a.apt_time) + '</td>' +
      '<td>' + (a.department || '-') + '</td>' +
      '<td><span class="badge ' + badgeCls + '">' + (a.status || '-') + '</span></td>' +
      '</tr>';
  }).join('');
}

function closeHistoryModal() {
  const overlay = document.getElementById('historyOverlay');
  if (overlay) overlay.classList.remove('active');
}

// ── LOAD ACTIVITY ─────────────────────────────────────────────────
function loadActivity(chamberId) {
  fetch('/doctor/chamber/' + chamberId + '/activity')
    .then(function(res) { return res.ok ? res.json() : []; })
    .catch(function() { return []; })
    .then(function(acts) { renderActivity(acts || []); });
}

function renderActivity(acts) {
  const desktop = document.querySelector('#dashboard .desktop-activity');
  const mobile  = document.querySelector('#dashboard .mobile-activity');

  if (!acts || acts.length === 0) {
    const msg = '<p style="color:var(--text-muted);padding:16px 0;text-align:center">No recent activity</p>';
    if (desktop) desktop.innerHTML = msg;
    if (mobile)  mobile.innerHTML  = msg;
    return;
  }

  if (desktop) {
    desktop.innerHTML = acts.map(function(a) {
      return '<div class="activity-card">' +
        '<strong>Appointment Completed</strong>' +
        '<p style="color:var(--text-muted);font-size:0.9rem;margin:5px 0 0">' +
          (a.name || 'Patient') + ' — ' + (a.department || 'OPD') +
          ' · ' + activityWhen(a.apt_date, a.apt_time) +
        '</p>' +
        '</div>';
    }).join('');
  }

  if (mobile) {
    mobile.innerHTML = acts.map(function(a) {
      return '<div class="activity-pill">' +
        '<div class="pill-icon" style="background:#ccfbf1;color:#0d9488">' +
          '<i class="fas fa-check-circle"></i>' +
        '</div>' +
        '<div class="pill-text">' +
          '<strong>Appointment Done</strong>' +
          '<span>' + (a.name || 'Patient') + ' · ' + activityWhen(a.apt_date, a.apt_time) + '</span>' +
        '</div>' +
        '</div>';
    }).join('');
  }
}

// ── LOAD DOCTOR PROFILE ───────────────────────────────────────────
function loadDoctorProfile() {
  const doctorId = sessionStorage.getItem('doctorId');
  if (!doctorId) return;

  fetch('/doctor/' + doctorId)
    .then(function(res) {
      if (!res.ok) return;
      return res.json();
    })
    .then(function(d) {
      if (!d) return;
      const set = function(id, val) { const el = document.getElementById(id); if (el && val) el.value = val; };
      set('profileName',  d.name);
      set('profileDept',  d.department_name || d.department_id);
      set('profileSpec',  d.specialization);
      set('profilePhone', d.phone_no);
      set('profileEmail', d.email);
    })
    .catch(function(e) { console.error('Profile load error:', e); });
}

// ── RESIZE ────────────────────────────────────────────────────────
window.addEventListener('resize', function() {
  const a = document.querySelector('.page-section.active');
  if (a) showPage(a.id, null);
});

// ── INIT ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  fetch('/doctor/dashboard', { credentials: 'same-origin' })
    .then(function(res) {
      if (res.status === 401) { window.location.href = 'login.html'; return null; }
      if (!res.ok) { console.error('Doctor dashboard error:', res.status); return null; }
      return res.json();
    })
    .then(function(data) {
      if (!data) return;
      if (data.doctor_id)  sessionStorage.setItem('doctorId',     data.doctor_id);
      if (data.name)       sessionStorage.setItem('userName',      data.name);
      if (data.chamber_no) sessionStorage.setItem('doctorChamber', data.chamber_no);

      const ov = document.getElementById('logoutOverlay');
      if (ov) ov.addEventListener('click', function(e) { if (e.target === ov) closeLogout(); });

      const ho = document.getElementById('historyOverlay');
      if (ho) ho.addEventListener('click', function(e) { if (e.target === ho) closeHistoryModal(); });

      showPage('dashboard', null, 'Home');
      showNavHint();
    })
    .catch(function(err) {
      console.error('Doctor dashboard network error:', err);
      window.location.href = 'login.html';
    });
});