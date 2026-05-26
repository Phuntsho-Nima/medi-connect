/* main.js – Patient portal logic, wired to Go backend */

const isMobile = () => window.innerWidth <= 750;

const pageTitles = {
  dashboard:    'Home',
  appointments: 'Appointments',
  profile:      'Profile'
};

const TIME_SLOTS = [
  { val: '09:00', label: '9:00 – 9:15 AM' },
  { val: '09:15', label: '9:15 – 9:30 AM' },
  { val: '09:30', label: '9:30 – 9:45 AM' },
  { val: '09:45', label: '9:45 – 10:00 AM' },
  { val: '10:00', label: '10:00 – 10:15 AM' },
  { val: '10:15', label: '10:15 – 10:30 AM' },
  { val: '10:30', label: '10:30 – 10:45 AM' },
  { val: '11:00', label: '11:00 – 11:15 AM' },
  { val: '11:30', label: '11:30 – 11:45 AM' },
  { val: '11:45', label: '11:45 AM – 12:00 PM' },
  { val: '12:00', label: '12:00 – 12:15 PM' },
  { val: '12:15', label: '12:15 – 12:30 PM' },
  { val: '12:30', label: '12:30 – 12:45 PM' },
  { val: '12:45', label: '12:45 – 1:00 PM' },
  { val: '14:00', label: '2:00 – 2:15 PM' },
  { val: '14:15', label: '2:15 – 2:30 PM' },
  { val: '14:30', label: '2:30 – 2:45 PM' },
  { val: '14:45', label: '2:45 – 3:00 PM' }
];

let _appointments = [];

// ── HELPERS ───────────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return '-';
  return d.includes('T') ? d.split('T')[0] : d;
}

function formatTime(t) {
  if (!t) return '-';
  return t.includes('T') ? t.split('T')[1].substring(0, 5) : t;
}

// ── PAGE SWITCHING ────────────────────────────────────────────────
function showPage(pageId, desktopEl, mobileTitle) {
  document.querySelectorAll('.page-section').forEach(function(s) { s.classList.remove('active'); });
  document.getElementById(pageId).classList.add('active');

  document.querySelectorAll('.desktop-nav-links li').forEach(function(l) { l.classList.remove('active'); });
  if (desktopEl && desktopEl.classList) desktopEl.classList.add('active');

  document.querySelectorAll('.bottom-nav ul li').forEach(function(l) { l.classList.remove('active'); });
  const bnavItem = document.getElementById('bnav-' + pageId);
  if (bnavItem) bnavItem.classList.add('active');

  const titleEl = document.getElementById('mobilePageTitle');
  if (titleEl) titleEl.textContent = mobileTitle || pageTitles[pageId] || '';

  const m = isMobile();
  document.querySelectorAll('.desktop-table').forEach(function(el) { el.style.display = m ? 'none' : 'block'; });
  document.querySelectorAll('.mobile-appt-list').forEach(function(el) { el.style.display = m ? 'block' : 'none'; });
  document.querySelectorAll('.desktop-activity').forEach(function(el) { el.style.display = m ? 'none' : 'block'; });
  document.querySelectorAll('.mobile-activity').forEach(function(el) { el.style.display = m ? 'block' : 'none'; });

  if (pageId === 'appointments') loadAppointments();
  if (pageId === 'profile')      loadProfile();
  if (pageId === 'dashboard')    loadDashboard();
}

// ── NAV HINT ─────────────────────────────────────────────────────
function showNavHint() {
  if (!isMobile() || sessionStorage.getItem('hintShown')) return;
  const hint = document.getElementById('navHint');
  if (!hint) return;
  hint.style.display = 'block';
  sessionStorage.setItem('hintShown', '1');
  setTimeout(function() {
    hint.style.transition = 'opacity 0.5s';
    hint.style.opacity = '0';
    setTimeout(function() { hint.style.display = 'none'; }, 500);
  }, 3000);
}

// ── LOGOUT ───────────────────────────────────────────────────────
function confirmLogout() { document.getElementById('logoutOverlay').classList.add('active'); }
function closeLogout()   { document.getElementById('logoutOverlay').classList.remove('active'); }

function doLogout() {
  fetch('/user/logout', { method: 'POST' })
    .catch(function() { /* ignore */ })
    .finally(function() {
      closeLogout();
      window.location.href = 'login.html';
    });
}

// ── LOAD DASHBOARD ────────────────────────────────────────────────
function loadDashboard() {
  const name = sessionStorage.getItem('userName') || 'Patient';
  const cid  = sessionStorage.getItem('userCid');

  const welcomeH2 = document.querySelector('.welcome-desktop h2');
  if (welcomeH2) welcomeH2.textContent = 'Welcome back, ' + name + '!';
  const mobileH2 = document.querySelector('.welcome-mobile h2');
  if (mobileH2) mobileH2.textContent = 'Hi, ' + name.split(' ')[0] + '!';

  if (!cid) return;

  fetch('/patient/appointments/' + cid)
    .then(function(res) { return res.ok ? res.json() : []; })
    .catch(function() { return []; })
    .then(function(apts) {
    apts = apts || [];

    const upcoming = apts.filter(function(a) { return a.status !== 'Cancelled'; }).length;

    const upcomingEl = document.querySelector('.stat-card.blue h4');
    if (upcomingEl) upcomingEl.textContent = upcoming;

    const desktopApptMsg = document.querySelector('.welcome-desktop p:first-of-type');
    if (desktopApptMsg) desktopApptMsg.innerHTML =
      '<i class="fas fa-calendar-check"></i> ' + upcoming + ' appointment' + (upcoming !== 1 ? 's' : '') + ' upcoming.';

    const mobileApptMsg = document.querySelector('.welcome-mobile p');
    if (mobileApptMsg) mobileApptMsg.innerHTML =
      '<i class="fas fa-calendar-check"></i> ' + upcoming + ' appointment' + (upcoming !== 1 ? 's' : '') + ' upcoming';

    const recent = apts.slice(0, 5);

    const desktopActivity = document.querySelector('.desktop-activity');
    if (desktopActivity) {
      desktopActivity.innerHTML = recent.length === 0
        ? '<p style="color:var(--text-muted)">No recent activity.</p>'
        : recent.map(function(a) {
            return '<div class="activity-card">' +
              '<strong>Appointment <span class="badge ' + statusBadgeClass(a.status) + '">' + (a.status || 'Pending') + '</span></strong>' +
              '<p style="color:var(--text-muted);font-size:0.9rem;margin:5px 0 0 0">' +
                'Chamber ' + (a.chamber_no || '-') + ' · ' + formatDate(a.apt_date) + ' at ' + formatTime(a.apt_time) +
              '</p>' +
              '</div>';
          }).join('');
    }

    const mobileActivity = document.querySelector('.mobile-activity');
    if (mobileActivity) {
      mobileActivity.innerHTML = recent.length === 0
        ? '<p style="color:var(--text-muted)">No recent activity.</p>'
        : recent.map(function(a) {
            const pillColor = a.status === 'Confirmed' ? 'blue' : (a.status === 'Cancelled' ? 'orange' : 'green');
            return '<div class="activity-pill">' +
              '<div class="pill-icon ' + pillColor + '"><i class="fas fa-calendar-check"></i></div>' +
              '<div class="pill-text">' +
                '<strong>Chamber ' + (a.chamber_no || '-') + '</strong>' +
                '<span>' + formatDate(a.apt_date) + ' · ' + formatTime(a.apt_time) + ' · ' + (a.status || 'Pending') + '</span>' +
              '</div>' +
              '</div>';
          }).join('');
    }
  });
}

// ── LOAD APPOINTMENTS ─────────────────────────────────────────────
function loadAppointments() {
  const cid = sessionStorage.getItem('userCid');
  if (!cid) return;
  fetch('/patient/appointments/' + cid)
    .then(function(res) {
      if (!res.ok) { showApptError('Could not load appointments.'); return null; }
      return res.json();
    })
    .then(function(apts) {
      if (apts === null) return;
      _appointments = apts || [];
      renderAppointments(_appointments);
    })
    .catch(function() { showApptError('Network error. Please try again.'); });
}

function showApptError(msg) {
  const tb = document.getElementById('appointmentTableBody');
  if (tb) tb.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:32px">' + msg + '</td></tr>';
  const ml = document.getElementById('mobileApptList');
  if (ml) ml.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:24px 0">' + msg + '</p>';
}

function statusBadgeClass(status) {
  if (!status) return 'status-on';
  const s = status.toLowerCase();
  if (s === 'confirmed' || s === 'approved') return 'status-on';
  if (s === 'pending')   return 'status-pending';
  if (s === 'cancelled') return 'status-off';
  return 'status-on';
}

function aptRowHTML(a) {
  return '<td>#' + a.appointment_id + '</td>' +
    '<td>' + (a.name || '-') + '</td>' +
    '<td>' + formatDate(a.apt_date) + '</td>' +
    '<td>' + formatTime(a.apt_time) + '</td>' +
    '<td>' + (a.cid || '-') + '</td>' +
    '<td><span class="badge ' + statusBadgeClass(a.status) + '">' + (a.status || 'Pending') + '</span></td>' +
    '<td>' +
      '<button class="btn-small" onclick="editAppointment(' + a.appointment_id + ')">Edit</button> ' +
      (a.status !== 'Cancelled'
        ? '<button class="btn-small btn-deact" onclick="cancelAppointment(' + a.appointment_id + ')">Cancel</button>'
        : '<span style="color:var(--text-muted);font-size:0.8rem">Cancelled</span>') +
    '</td>';
}

function aptCardHTML(a) {
  return '<div class="appt-card-header">' +
      '<strong>' + (a.name || 'Patient') + '</strong>' +
      '<span class="badge ' + statusBadgeClass(a.status) + '">' + (a.status || 'Pending') + '</span>' +
    '</div>' +
    '<div class="appt-card-body">' +
      '<div class="appt-info-item"><span class="info-label">Date</span><span class="info-value">' + formatDate(a.apt_date) + '</span></div>' +
      '<div class="appt-info-item"><span class="info-label">Time</span><span class="info-value">' + formatTime(a.apt_time) + '</span></div>' +
      '<div class="appt-info-item"><span class="info-label">Chamber</span><span class="info-value">' + (a.chamber_no || '-') + '</span></div>' +
      '<div class="appt-info-item"><span class="info-label">ID</span><span class="info-value">#' + a.appointment_id + '</span></div>' +
    '</div>' +
    '<button class="btn-small" style="width:100%;margin-bottom:6px" onclick="editAppointment(' + a.appointment_id + ')">Edit</button>' +
    (a.status !== 'Cancelled'
      ? '<button class="btn-small btn-deact" style="width:100%" onclick="cancelAppointment(' + a.appointment_id + ')">' +
          '<i class="fas fa-times" style="margin-right:6px"></i>Cancel' +
        '</button>'
      : '');
}

function renderAppointments(apts) {
  const m  = isMobile();
  const tb = document.getElementById('appointmentTableBody');
  const ml = document.getElementById('mobileApptList');

  if (apts.length === 0) {
    if (tb) tb.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:32px">No appointments yet</td></tr>';
    if (ml) ml.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:24px 0">No appointments yet</p>';
    return;
  }

  if (tb) {
    tb.innerHTML = apts.map(function(a) {
      return '<tr id="apt-row-' + a.appointment_id + '">' + aptRowHTML(a) + '</tr>';
    }).join('');
  }

  if (ml && m) {
    ml.innerHTML = apts.map(function(a) {
      return '<div class="appt-card" id="apt-card-' + a.appointment_id + '">' + aptCardHTML(a) + '</div>';
    }).join('');
  }
}

// ── EDIT APPOINTMENT (inline card) ───────────────────────────────
function closeEditCard() {
  const card     = document.getElementById('editApptCard');
  const backdrop = document.getElementById('editApptBackdrop');
  if (card)     card.remove();
  if (backdrop) backdrop.remove();
}

function editAppointment(id) {
  const apt = _appointments.find(function(a) { return a.appointment_id === id; });
  closeEditCard();

  const currentDate = apt ? formatDate(apt.apt_date) : '';
  const currentTime = apt ? formatTime(apt.apt_time) : '';

  const slotOptions = TIME_SLOTS.map(function(s) {
    return '<option value="' + s.val + '"' + (currentTime === s.val ? ' selected' : '') + '>' + s.label + '</option>';
  }).join('');

  const backdrop = document.createElement('div');
  backdrop.id = 'editApptBackdrop';
  backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:999';
  backdrop.onclick = closeEditCard;

  const card = document.createElement('div');
  card.id = 'editApptCard';
  card.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:1000;' +
    'background:#fff;padding:28px;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.25);' +
    'min-width:300px;max-width:90vw;width:380px;box-sizing:border-box';
  card.innerHTML =
    '<h3 style="margin:0 0 20px 0;font-size:1.1rem">Edit Appointment #' + id + '</h3>' +
    '<div class="form-group" style="margin-bottom:14px">' +
      '<label style="display:block;margin-bottom:4px;font-size:0.85rem;font-weight:600">Date</label>' +
      '<input type="date" id="editDate" value="' + currentDate + '" style="width:100%;box-sizing:border-box" />' +
    '</div>' +
    '<div class="form-group" style="margin-bottom:20px">' +
      '<label style="display:block;margin-bottom:4px;font-size:0.85rem;font-weight:600">Time Slot</label>' +
      '<select id="editTime" style="width:100%;box-sizing:border-box">' + slotOptions + '</select>' +
    '</div>' +
    '<div style="display:flex;gap:10px">' +
      '<button class="btn-primary" style="flex:1" onclick="saveEditAppointment(' + id + ')">Save</button>' +
      '<button class="btn-cancel" style="flex:1" onclick="closeEditCard()">Cancel</button>' +
    '</div>';

  document.body.appendChild(backdrop);
  document.body.appendChild(card);
}

function saveEditAppointment(id) {
  const newDate = document.getElementById('editDate').value;
  const newTime = document.getElementById('editTime').value;

  if (!newDate) { alert('Please select a date.'); return; }
  if (!newTime) { alert('Please select a time slot.'); return; }

  const apt = _appointments.find(function(a) { return a.appointment_id === id; });

  fetch('/appointment/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apt_date:   newDate,
      apt_time:   newTime,
      chamber_no: apt ? apt.chamber_no : 0,
      cid:        apt ? apt.cid : (sessionStorage.getItem('userCid') || ''),
      status:     apt ? apt.status : 'Pending'
    })
  })
  .then(function(res) {
    if (res.ok) {
      if (apt) {
        apt.apt_date = newDate;
        apt.apt_time = newTime;
        const row = document.getElementById('apt-row-' + id);
        if (row) row.innerHTML = aptRowHTML(apt);
        const mcard = document.getElementById('apt-card-' + id);
        if (mcard) mcard.innerHTML = aptCardHTML(apt);
      }
      closeEditCard();
    } else {
      return res.json().then(function(d) { alert('Error: ' + (d.error || 'Could not update.')); });
    }
  })
  .catch(function() { alert('Network error.'); });
}

// ── BOOK APPOINTMENT ──────────────────────────────────────────────
function bookAppointment(e) {
  e.preventDefault();

  const chamberEl = document.getElementById('chamberNo');
  const chamberNo = chamberEl ? chamberEl.value : null;
  const aptDate = document.getElementById('appointmentDate').value;
  const formattedDate = aptDate ? aptDate : '';
  const aptTime = document.getElementById('appointmentTime').value;
  const cid = sessionStorage.getItem('userCid');

  if (!chamberNo) { alert('Please select a chamber.'); return; }
  if (!cid) { alert('Session expired. Please log in again.'); window.location.href = 'login.html'; return; }
  if (!formattedDate) { alert('Please select a date.'); return; }

  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Booking...'; }

  fetch('/appointment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apt_date:   formattedDate,
      apt_time:   aptTime,
      chamber_no: parseInt(chamberNo),
      cid:        cid,
      status:     'Pending'
    })
  })
  .then(function(res) {
    return res.json().then(function(data) {
      if (!res.ok) {
        alert('Booking failed: ' + (data.error || 'Unknown error'));
      } else {
        alert('Appointment booked! ID: #' + data.aptID);
        e.target.reset();
        loadAppointments();
      }
    });
  })
  .catch(function() { alert('Network error. Please try again.'); })
  .finally(function() {
    if (btn) { btn.disabled = false; btn.textContent = 'Book Appointment'; }
  });
}

// ── CANCEL APPOINTMENT ────────────────────────────────────────────
function cancelAppointment(id) {
  if (!confirm('Cancel this appointment?')) return;

  fetch('/appointment/' + id, { method: 'DELETE' })
    .then(function(res) {
      if (res.ok) {
        const row = document.getElementById('apt-row-' + id);
        if (row) row.remove();
        const card = document.getElementById('apt-card-' + id);
        if (card) card.remove();
      } else {
        return res.json().then(function(data) {
          alert('Error: ' + (data.error || 'Could not cancel.'));
        });
      }
    })
    .catch(function() { alert('Network error. Please try again.'); });
}

// ── LOAD CHAMBERS ─────────────────────────────────────────────────
function loadChambers() {
  const select = document.getElementById('chamberNo');
  if (!select) return;

  fetch('/chambers/available')
    .then(function(res) {
      if (!res.ok) return null;
      return res.json();
    })
    .then(function(chambers) {
      if (!chambers) return;
      select.innerHTML = '<option value="">Select Chamber</option>' +
        chambers.map(function(c) {
          return '<option value="' + c.chamberNo + '">' + c.chamberName + ' — ' + (c.departmentName || '') + '</option>';
        }).join('');
    })
    .catch(function(e) { console.error('Could not load chambers:', e); });
}

// ── LOAD PROFILE ──────────────────────────────────────────────────
function loadProfile() {
  const cid = sessionStorage.getItem('userCid');
  if (!cid) return;

  fetch('/user/' + cid)
    .then(function(res) {
      if (!res.ok) return null;
      return res.json();
    })
    .then(function(u) {
      if (!u) return;
      const set = function(id, val) { const el = document.getElementById(id); if (el && val != null) el.value = val; };
      set('profileName',      u.name);
      set('profileCid',       u.cid);
      set('profileDzongkhag', u.dzongkhag);
      set('profileGewog',     u.gewog);
      set('profilePhone',     u.phone_no);
      set('profileGender',    u.gender);
      set('profileDob',       u.dob ? u.dob.split('T')[0] : '');
    })
    .catch(function(e) { console.error('Could not load profile:', e); });
}

// ── SAVE PROFILE ──────────────────────────────────────────────────
function saveProfile(e) {
  e.preventDefault();
  const cid = sessionStorage.getItem('userCid');
  const g = function(id) { const el = document.getElementById(id); return el ? el.value : ''; };
  const payload = {
    name:      g('profileName'),
    dzongkhag: g('profileDzongkhag'),
    gewog:     g('profileGewog'),
    phone_no:  g('profilePhone'),
    gender:    g('profileGender'),
    dob:       g('profileDob')
  };

  fetch('/user/' + cid, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  .then(function(res) {
    alert(res.ok ? 'Profile updated!' : 'Could not save changes.');
  })
  .catch(function() { alert('Network error.'); });
}

// ── CHANGE PASSWORD ───────────────────────────────────────────────
function changePassword(e) {
  e.preventDefault();
  const cid     = sessionStorage.getItem('userCid');
  const current = document.getElementById('currentPassword').value;
  const newPw   = document.getElementById('newPassword').value;
  const confirm = document.getElementById('confirmPassword').value;

  if (!current || !newPw || !confirm) { alert('All fields are required.'); return; }
  if (newPw !== confirm) { alert('New passwords do not match.'); return; }

  fetch('/user/' + cid + '/password', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ current_password: current, new_password: newPw })
  })
  .then(function(res) {
    return res.json().then(function(data) {
      if (res.ok) {
        alert('Password changed successfully.');
        document.getElementById('changePasswordForm').reset();
      } else {
        alert('Error: ' + (data.error || 'Could not change password.'));
      }
    });
  })
  .catch(function() { alert('Network error.'); });
}

// ── RESIZE HANDLER ────────────────────────────────────────────────
window.addEventListener('resize', function() {
  const active = document.querySelector('.page-section.active');
  if (active) showPage(active.id, null);
});

// ── INIT ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  const cid = sessionStorage.getItem('userCid');
  if (!cid) { window.location.href = 'login.html'; return; }

  const overlay = document.getElementById('logoutOverlay');
  if (overlay) overlay.addEventListener('click', function(e) { if (e.target === overlay) closeLogout(); });

  const apptForm = document.getElementById('appointmentForm');
  if (apptForm) apptForm.addEventListener('submit', bookAppointment);

  const profileForm = document.getElementById('profileForm');
  if (profileForm) profileForm.addEventListener('submit', saveProfile);

  const pwForm = document.getElementById('changePasswordForm');
  if (pwForm) pwForm.addEventListener('submit', changePassword);

  loadChambers();
  showPage('dashboard', null, 'Home');
  showNavHint();
});
