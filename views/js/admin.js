/* admin.js – Admin dashboard logic, wired to Go backend */

const isMobile = () => window.innerWidth <= 750;

const pageTitles = {
  dashboard:    'Home',
  doctors:      'Doctors',
  appointments: 'Appointments',
  reports:      'Reports',
  settings:     'Settings'
};

// ── PAGE SWITCHING ────────────────────────────────────────────────
function showPage(pageId, desktopEl, mobileTitle) {
  document.querySelectorAll('.page-section').forEach(function(s) { s.classList.remove('active'); });
  document.getElementById(pageId).classList.add('active');

  document.querySelectorAll('.desktop-nav-links li').forEach(function(l) { l.classList.remove('active'); });
  if (desktopEl && desktopEl.classList) desktopEl.classList.add('active');

  document.querySelectorAll('.bottom-nav ul li').forEach(function(l) { l.classList.remove('active'); });
  var b = document.getElementById('bnav-' + pageId);
  if (b) b.classList.add('active');

  document.getElementById('mobilePageTitle').textContent = mobileTitle || pageTitles[pageId] || '';

  var m = isMobile();
  document.querySelectorAll('.desktop-table').forEach(function(el) { el.style.display = m ? 'none' : 'block'; });
  document.querySelectorAll('.mobile-card-list').forEach(function(el) { el.style.display = m ? 'block' : 'none'; });

  var da = document.querySelectorAll('.desktop-activity');
  var ma = document.querySelectorAll('.mobile-activity');
  da.forEach(function(el) { el.style.display = m ? 'none' : 'block'; });
  ma.forEach(function(el) { el.style.display = m ? 'block' : 'none'; });

  if (pageId === 'dashboard')    loadAdminDashboard();
  if (pageId === 'appointments') loadAllAppointments();
  if (pageId === 'doctors')      { loadAllDoctors(); loadChamberDropdown(); }
  if (pageId === 'settings')     loadSettings();
}

function showNavHint() {
  if (!isMobile() || sessionStorage.getItem('adminHint')) return;
  var h = document.getElementById('navHint');
  if (!h) return;
  h.style.display = 'block';
  sessionStorage.setItem('adminHint', '1');
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
  fetch('/admin/logout', { method: 'POST' })
    .catch(function() { })
    .finally(function() {
      closeLogout();
      window.location.href = 'login.html';
    });
}

// ── LOAD ADMIN DASHBOARD ──────────────────────────────────────────
function loadAdminDashboard() {
  fetch('/admin/dashboard')
    .then(function(res) { return res.ok ? res.json() : null; })
    .then(function(d) {
      if (!d) return;

      var set = function(id, val) {
        var el = document.getElementById(id);
        if (el && val !== undefined) el.textContent = val;
      };
      set('statUsers',        d.total_users        || 0);
      set('statDoctors',      d.total_doctors      || 0);
      set('statAppointments', d.total_appointments || 0);

      // Reports bar values
      set('reportPatients', d.total_users   || '—');
      set('reportDoctors',  d.total_doctors || '—');

      // Welcome banner
      var name = sessionStorage.getItem('userName') || 'Admin';
      var wh = document.getElementById('welcomeHeading');
      var wm = document.getElementById('welcomeMobileHeading');
      if (wh) wh.textContent = 'Welcome, Admin ' + name + '!';
      if (wm) wm.textContent = 'Hi, ' + name + ' 👋';

      var ws = document.getElementById('welcomeStats');
      var wms = document.getElementById('welcomeMobileStats');
      var uCount = (d.total_users || 0) + ' registered users';
      var aCount = (d.total_appointments || 0) + ' total appointments';
      if (ws)  ws.innerHTML  = '<i class="fas fa-users"></i> ' + uCount + ' &nbsp;·&nbsp; <i class="fas fa-calendar-check"></i> ' + aCount;
      if (wms) wms.innerHTML = '<i class="fas fa-users"></i> ' + uCount + ' · ' + aCount;

      setTimeout(animateBars, 300);
    })
    .catch(function(e) { console.error('Dashboard load error:', e); });

  loadAdminActivity();
}

// ── SYSTEM ACTIVITY ───────────────────────────────────────────────
var activityDotColor = {
  user_registered:    'purple',
  doctor_added:       'blue',
  appointment_booked: 'amber'
};
var activityLabel = {
  user_registered:    'New patient registered',
  doctor_added:       'Doctor added',
  appointment_booked: 'Appointment booked'
};

function adminActivityWhen(eventTimeStr) {
  if (!eventTimeStr) return '';
  var dt = new Date(eventTimeStr);
  var today = new Date();
  var yest  = new Date(Date.now() - 86400000);
  var sameDay = function(a, b) {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth()    === b.getMonth()    &&
           a.getDate()     === b.getDate();
  };
  var h    = dt.getHours();
  var m    = String(dt.getMinutes()).padStart(2, '0');
  var ampm = h >= 12 ? 'PM' : 'AM';
  var h12  = h % 12 || 12;
  var t    = h12 + ':' + m + ' ' + ampm;
  if (sameDay(dt, today)) return 'Today ' + t;
  if (sameDay(dt, yest))  return 'Yesterday ' + t;
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + t;
}

function loadAdminActivity() {
  fetch('/admin/activity')
    .then(function(res) { return res.ok ? res.json() : []; })
    .then(function(events) { renderAdminActivity(events || []); })
    .catch(function(e) { console.error('Activity load error:', e); });
}

function renderAdminActivity(events) {
  var da = document.querySelector('#dashboard .desktop-activity');
  var ma = document.querySelector('#dashboard .mobile-activity');

  if (!events || events.length === 0) {
    var empty = '<p style="text-align:center;color:var(--text-muted);padding:24px 0">No recent activity</p>';
    if (da) da.innerHTML = empty;
    if (ma) ma.innerHTML = empty;
    return;
  }

  var html = events.map(function(e) {
    var dc = activityDotColor[e.event_type] || 'purple';
    var lb = activityLabel[e.event_type]    || e.event_type;
    var when = adminActivityWhen(e.event_time);
    return '<div class="feed-item">' +
      '<div class="feed-dot ' + dc + '"></div>' +
      '<div class="feed-text">' +
        '<strong>' + lb + '</strong>' +
        '<span>' + (e.name || '-') + ' · ' + when + '</span>' +
      '</div>' +
      '</div>';
  }).join('');

  if (da) da.innerHTML = html;
  if (ma) ma.innerHTML = html;
}

// ── LOAD ALL APPOINTMENTS ─────────────────────────────────────────
function loadAllAppointments() {
  fetch('/admin/appointments')
    .then(function(res) { return res.ok ? res.json() : null; })
    .then(function(apts) { renderAdminAppointments(apts || []); })
    .catch(function(e) { console.error('Appointments load error:', e); });
}

// Parse "2026-05-27T00:00:00Z" or "2026-05-27" → "27 May 2026"
// Splits the string directly to avoid timezone-shift from new Date()
function formatAptDate(dateStr) {
  if (!dateStr) return '-';
  var parts = String(dateStr).split('T')[0].split('-');
  if (parts.length !== 3) return dateStr;
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var m = parseInt(parts[1], 10) - 1;
  if (m < 0 || m > 11) return dateStr;
  return parseInt(parts[2], 10) + ' ' + months[m] + ' ' + parts[0];
}

function aptStatusBadgeClass(status) {
  if (!status) return 'status-pending';
  var s = status.toLowerCase();
  if (s === 'completed') return 'status-active';
  if (s === 'pending')   return 'status-pending';
  if (s === 'cancelled') return 'status-inactive';
  return 'status-pending';
}

function formatAptTime(t) {
  if (!t) return '-';
  var parts = t.split(':');
  var h = parseInt(parts[0], 10);
  var m = parts[1] || '00';
  var ampm = h >= 12 ? 'PM' : 'AM';
  var h12 = h % 12 || 12;
  return h12 + ':' + m + ' ' + ampm;
}

function renderAdminAppointments(apts) {
  var tb = document.querySelector('#appointments tbody');
  var ml = document.querySelector('#appointments .mobile-card-list');

  if (!apts || apts.length === 0) {
    if (tb) tb.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:32px">No appointments found</td></tr>';
    if (ml) ml.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:24px 0">No appointments found</p>';
    return;
  }

  if (tb) {
    tb.innerHTML = apts.map(function(a, i) {
      var actions = '';
      if (a.status !== 'Cancelled') {
        if (a.status === 'Pending') {
          actions += '<button class="btn-small btn-activate" onclick="completeAppt(' + a.appointment_id + ')">Mark Done</button> ';
        }
        actions += '<button class="btn-small btn-deact" onclick="cancelAppt(' + a.appointment_id + ')">Cancel</button>';
      } else {
        actions = '<span style="color:var(--text-muted);font-size:0.8rem">Cancelled</span>';
      }
      return '<tr id="aprow-' + a.appointment_id + '">' +
        '<td>' + (i + 1) + '</td>' +
        '<td>' + (a.name || '-') + '</td>' +
        '<td>' + (a.cid || '-') + '</td>' +
        '<td>' + (a.doctor_name || '-') + '</td>' +
        '<td>' + (a.department || '-') + '</td>' +
        '<td>' + formatAptDate(a.apt_date) + '</td>' +
        '<td>' + formatAptTime(a.apt_time) + '</td>' +
        '<td><span class="badge ' + aptStatusBadgeClass(a.status) + '">' + (a.status || 'Pending') + '</span></td>' +
        '<td>' + actions + '</td>' +
        '</tr>';
    }).join('');
  }

  if (ml) {
    ml.innerHTML = apts.map(function(a) {
      var actions = '';
      if (a.status !== 'Cancelled') {
        if (a.status === 'Pending') {
          actions += '<button class="btn-small btn-activate apt-mc-btn" onclick="completeAppt(' + a.appointment_id + ')">Mark Done</button>';
        }
        actions += '<button class="btn-small btn-deact apt-mc-btn" onclick="cancelAppt(' + a.appointment_id + ')">Cancel</button>';
      }
      return '<div class="apt-mobile-card">' +
        '<div class="apt-mc-id">#' + a.appointment_id + ' — ' + (a.name || 'Patient') + '</div>' +
        '<div class="apt-mc-status"><span class="badge ' + aptStatusBadgeClass(a.status) + '">' + (a.status || 'Pending') + '</span></div>' +
        '<div class="apt-mc-row"><span class="apt-mc-label">Doctor</span><span class="apt-mc-value">' + (a.doctor_name || '-') + '</span></div>' +
        '<div class="apt-mc-row"><span class="apt-mc-label">Dept</span><span class="apt-mc-value">' + (a.department || '-') + '</span></div>' +
        '<div class="apt-mc-row apt-mc-row-last"><span class="apt-mc-label">Date</span><span class="apt-mc-value">' + formatAptDate(a.apt_date) + '</span></div>' +
        (actions ? '<div class="apt-mc-actions">' + actions + '</div>' : '') +
        '</div>';
    }).join('');
  }
}

// ── COMPLETE / CANCEL APPOINTMENT ────────────────────────────────
function completeAppt(id) {
  fetch('/admin/appointment/' + id + '/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Completed' })
  })
  .then(function(res) {
    if (!res.ok) { alert('Could not mark appointment as done.'); return; }
    loadAllAppointments();
  })
  .catch(function() { alert('Network error.'); });
}

function cancelAppt(id) {
  if (!confirm('Cancel appointment #' + id + '?')) return;
  fetch('/admin/appointment/' + id + '/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Cancelled' })
  })
  .then(function(res) {
    if (res.ok) loadAllAppointments();
    else alert('Could not cancel appointment.');
  })
  .catch(function() { alert('Network error.'); });
}

// ── CHAMBER DROPDOWN ──────────────────────────────────────────────
function loadChamberDropdown() {
  fetch('/chambers/available')
    .then(function(res) { return res.ok ? res.json() : []; })
    .then(function(chambers) {
      var sel = document.getElementById('newDoctorChamber');
      if (!sel) return;
      var opts = '<option value="">— Select chamber —</option>';
      (chambers || []).forEach(function(c) {
        opts += '<option value="' + c.chamberNo + '">' + c.chamberName + (c.departmentName ? ' (' + c.departmentName + ')' : '') + '</option>';
      });
      sel.innerHTML = opts;
    })
    .catch(function(e) { console.error('Chamber dropdown error:', e); });
}

// ── ADD DOCTOR ────────────────────────────────────────────────────
function addDoctor(e) {
  e.preventDefault();
  var doctorId  = parseInt(document.getElementById('newDoctorId')  ? document.getElementById('newDoctorId').value  : 0) || 0;
  var name      = document.getElementById('newDoctorName') ? document.getElementById('newDoctorName').value.trim() : '';
  var spec      = document.getElementById('newDoctorSpec') ? document.getElementById('newDoctorSpec').value.trim() : '';
  var chamberNo = parseInt(document.getElementById('newDoctorChamber') ? document.getElementById('newDoctorChamber').value : 0) || 0;
  var password  = document.getElementById('newDoctorPass') ? document.getElementById('newDoctorPass').value : '';

  if (!name || !password) { alert('Name and password are required.'); return; }

  fetch('/admin/doctor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doctor_id: doctorId, name: name, specialization: spec, chamber_no: chamberNo, password: password })
  })
  .then(function(res) {
    return res.json().then(function(data) {
      if (res.ok) {
        alert('Doctor added! ID: ' + data.doctorId);
        e.target.reset();
        loadAllDoctors();
        loadChamberDropdown();
      } else {
        alert('Error: ' + (data.error || 'Could not add doctor.'));
      }
    });
  })
  .catch(function() { alert('Network error.'); });
}

// ── LOAD DOCTORS ──────────────────────────────────────────────────
function loadAllDoctors() {
  fetch('/admin/doctors')
    .then(function(res) { return res.ok ? res.json() : null; })
    .then(function(doctors) {
      var tb = document.querySelector('#doctors tbody');
      var ml = document.querySelector('#doctors .mobile-card-list');
      if (!tb) return;

      if (!doctors || doctors.length === 0) {
        tb.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px">No doctors found</td></tr>';
        if (ml) ml.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:24px 0">No doctors found</p>';
        return;
      }

      tb.innerHTML = doctors.map(function(d) {
        return '<tr>' +
          '<td>' + d.doctor_id + '</td>' +
          '<td>' + (d.name || '-') + '</td>' +
          '<td>' + (d.specialization || '-') + '</td>' +
          '<td>' + (d.department_name || '-') + '</td>' +
          '<td>' + (d.chamber_name || '-') + '</td>' +
          '<td><button class="btn-small btn-deact" onclick="deleteDoctor(' + d.doctor_id + ')">Remove</button></td>' +
          '</tr>';
      }).join('');

      if (ml) {
        ml.innerHTML = doctors.map(function(d) {
          return '<div class="note-card" style="border:1px solid var(--border)">' +
            '<div class="note-card-header">' +
              '<strong>ID ' + d.doctor_id + ' — ' + (d.name || '-') + '</strong>' +
            '</div>' +
            '<p>' + (d.specialization || 'No specialization') + ' · ' + (d.department_name || '-') + ' · ' + (d.chamber_name || 'No chamber') + '</p>' +
            '<div style="margin-top:8px">' +
              '<button class="btn-small btn-deact" onclick="deleteDoctor(' + d.doctor_id + ')">Remove</button>' +
            '</div>' +
            '</div>';
        }).join('');
      }
    })
    .catch(function(e) { console.error('Doctors load error:', e); });
}

function deleteDoctor(id) {
  if (!confirm('Remove doctor #' + id + '?')) return;
  fetch('/admin/doctor/' + id, { method: 'DELETE' })
    .then(function(res) {
      if (res.ok) loadAllDoctors();
      else alert('Could not remove doctor.');
    })
    .catch(function() { alert('Network error.'); });
}

// ── SETTINGS ─────────────────────────────────────────────────────
function loadSettings() {
  // Pre-fill hospital name
  fetch('/admin/settings/hospital-name')
    .then(function(res) { return res.ok ? res.json() : null; })
    .then(function(d) {
      if (d) {
        var el = document.getElementById('hospitalNameInput');
        if (el) el.value = d.hospital_name || '';
      }
    })
    .catch(function() { });

  // Pre-fill admin email
  fetch('/admin/settings/profile')
    .then(function(res) { return res.ok ? res.json() : null; })
    .then(function(d) {
      if (d) {
        var el = document.getElementById('adminEmailInput');
        if (el) el.value = d.email || '';
      }
    })
    .catch(function() { });
}

function showSettingsNotice(msg, ok) {
  var el = document.getElementById('settingsNotice');
  if (!el) return;
  el.innerHTML = '<i class="fas fa-' + (ok ? 'check-circle' : 'exclamation-circle') + '"></i> ' + msg;
  el.className = 'settings-notice ' + (ok ? 'success' : 'error');
  el.style.display = 'flex';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  setTimeout(function() { el.style.display = 'none'; }, 5000);
}

function togglePw(inputId, btn) {
  var inp = document.getElementById(inputId);
  if (!inp) return;
  var hidden = inp.type === 'password';
  inp.type = hidden ? 'text' : 'password';
  var icon = btn.querySelector('i');
  if (icon) icon.className = hidden ? 'fas fa-eye-slash' : 'fas fa-eye';
}

function saveHospitalName() {
  var name = (document.getElementById('hospitalNameInput') || {}).value || '';
  if (!name.trim()) { showSettingsNotice('Hospital name cannot be empty.', false); return; }
  fetch('/admin/settings/hospital-name', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hospital_name: name.trim() })
  })
  .then(function(res) {
    return res.json().then(function(d) { return { ok: res.ok, d: d }; });
  })
  .then(function(r) {
    showSettingsNotice(r.ok ? 'Hospital name saved!' : (r.d.error || 'Failed to save.'), r.ok);
  })
  .catch(function() { showSettingsNotice('Network error — could not save.', false); });
}

function saveAdminEmail() {
  var email = (document.getElementById('adminEmailInput') || {}).value || '';
  if (!email.trim()) { showSettingsNotice('Email cannot be empty.', false); return; }
  fetch('/admin/settings/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim() })
  })
  .then(function(res) {
    return res.json().then(function(d) { return { ok: res.ok, d: d }; });
  })
  .then(function(r) {
    showSettingsNotice(r.ok ? 'Admin email updated successfully!' : (r.d.error || 'Failed to update email.'), r.ok);
  })
  .catch(function() { showSettingsNotice('Network error — could not update email.', false); });
}

function saveAdminPassword() {
  var cur  = (document.getElementById('settingsCurrentPass') || {}).value || '';
  var nw   = (document.getElementById('settingsNewPass')     || {}).value || '';
  var conf = (document.getElementById('settingsConfirmPass') || {}).value || '';

  if (!cur || !nw || !conf) {
    showSettingsNotice('All three password fields are required.', false); return;
  }
  if (nw !== conf) {
    showSettingsNotice('New password and confirmation do not match.', false); return;
  }

  fetch('/admin/settings/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ current_password: cur, new_password: nw })
  })
  .then(function(res) {
    return res.json().then(function(d) { return { ok: res.ok, d: d }; });
  })
  .then(function(r) {
    if (r.ok) {
      document.getElementById('settingsCurrentPass').value = '';
      document.getElementById('settingsNewPass').value     = '';
      document.getElementById('settingsConfirmPass').value = '';
      showSettingsNotice('Password changed successfully!', true);
    } else {
      showSettingsNotice(r.d.error || 'Failed to change password.', false);
    }
  })
  .catch(function() { showSettingsNotice('Network error — could not change password.', false); });
}

// ── BAR CHART ANIMATION ───────────────────────────────────────────
function animateBars() {
  document.querySelectorAll('.bar-fill[data-w]').forEach(function(b) { b.style.width = b.dataset.w; });
}

// ── RESIZE ────────────────────────────────────────────────────────
window.addEventListener('resize', function() {
  var a = document.querySelector('.page-section.active');
  if (a) showPage(a.id, null);
});

// ── INIT ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  fetch('/admin/dashboard', { credentials: 'same-origin' })
    .then(function(res) {
      if (res.status === 401) { window.location.href = 'login.html'; return null; }
      if (!res.ok) { console.error('Admin dashboard error:', res.status); return null; }
      return res;
    })
    .then(function(res) {
      if (!res) return;

      var ov = document.getElementById('logoutOverlay');
      if (ov) ov.addEventListener('click', function(e) { if (e.target === ov) closeLogout(); });

      var addDoctorForm = document.getElementById('addDoctorForm');
      if (addDoctorForm) addDoctorForm.addEventListener('submit', addDoctor);

      showPage('dashboard', null, 'Home');
      showNavHint();
    })
    .catch(function(err) { console.error('Admin dashboard network error:', err); window.location.href = 'login.html'; });
});
