/* main.js – Patient portal logic, wired to Go backend */

const isMobile = () => window.innerWidth <= 750;

const pageTitles = {
  dashboard:    'Home',
  appointments: 'Appointments',
  records:      'Records',
  profile:      'Profile'
};
setTimeout (3000, () => console.log("Loaded") ) 
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
  if (pageId === 'records')      loadRecords();
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
  if (mobileH2) mobileH2.textContent = 'Hi, ' + name.split(' ')[0] + ' 👋';

  if (!cid) return;

  fetch('/patient/appointments/' + cid)
    .then(function(res) {
      if (!res.ok) return null;
      return res.json();
    })
    .then(function(apts) {
      if (!apts) return;
      const upcoming = apts.filter(function(a) {
        return a.status === 'Pending' || a.status === 'Confirmed';
      }).length;

      const upcomingEl = document.querySelector('.stat-card.blue h4');
      if (upcomingEl) upcomingEl.textContent = upcoming;

      const desktopApptMsg = document.querySelector('.welcome-desktop p:first-of-type');
      if (desktopApptMsg) desktopApptMsg.innerHTML =
        '<i class="fas fa-calendar-check"></i> ' + upcoming + ' appointment' + (upcoming !== 1 ? 's' : '') + ' upcoming.';
    })
    .catch(function(e) { console.error('Dashboard load error:', e); });
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
      console.log('appointments:', JSON.stringify(apts[0]));
      renderAppointments(apts || []);
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
    var timeDisplay = (a.apt_time || '-');
    if (timeDisplay.includes('T')) {
      timeDisplay = timeDisplay.split('T')[1].substring(0, 5);
    }
    var dateDisplay = (a.apt_date || '-');
    if (dateDisplay.includes('T')) {
      dateDisplay = dateDisplay.split('T')[0];
    }
    return '<tr>' +
      '<td>#' + a.appointment_id + '</td>' +
      '<td>' + (a.name || '-') + '</td>' +
      '<td>' + dateDisplay + '</td>' +
      '<td>' + timeDisplay + '</td>' +
      '<td>' + (a.cid || '-') + '</td>' +
      '<td><span class="badge ' + statusBadgeClass(a.status) + '">' + (a.status || 'Pending') + '</span></td>' +
      '<td>' +
        '<button class="btn-small" onclick="editAppointment(' + a.appointment_id + ')">Edit</button> ' +
        (a.status !== 'Cancelled'
          ? '<button class="btn-small btn-deact" onclick="cancelAppointment(' + a.appointment_id + ')">Cancel</button>'
          : '<span style="color:var(--text-muted);font-size:0.8rem">Cancelled</span>') +
      '</td>' +
      '</tr>';
  }).join('');
}

if (ml && m) {
    ml.innerHTML = apts.map(function(a) {
      var timeDisplay = (a.apt_time || '-');
      if (timeDisplay.includes('T')) {
        timeDisplay = timeDisplay.split('T')[1].substring(0, 5);
      }
      var dateDisplay = (a.apt_date || '-');
      if (dateDisplay.includes('T')) {
        dateDisplay = dateDisplay.split('T')[0];
      }
      return '<div class="appt-card">' +
        '<div class="appt-card-header">' +
          '<strong>' + (a.name || 'Patient') + '</strong>' +
          '<span class="badge ' + statusBadgeClass(a.status) + '">' + (a.status || 'Pending') + '</span>' +
        '</div>' +
        '<div class="appt-card-body">' +
          '<div class="appt-info-item"><span class="info-label">Date</span><span class="info-value">' + dateDisplay + '</span></div>' +
          '<div class="appt-info-item"><span class="info-label">Time</span><span class="info-value">' + timeDisplay + '</span></div>' +
          '<div class="appt-info-item"><span class="info-label">Chamber</span><span class="info-value">' + (a.chamber_no || '-') + '</span></div>' +
          '<div class="appt-info-item"><span class="info-label">ID</span><span class="info-value">#' + a.appointment_id + '</span></div>' +
        '</div>' +
        '<button class="btn-small" style="width:100%;margin-bottom:6px" onclick="editAppointment(' + a.appointment_id + ')">Edit</button>' +
        (a.status !== 'Cancelled'
          ? '<button class="btn-small btn-deact" style="width:100%" onclick="cancelAppointment(' + a.appointment_id + ')">' +
              '<i class="fas fa-times" style="margin-right:6px"></i>Cancel' +
            '</button>'
          : '') +
        '</div>';
    }).join('');
  }
}

// ── EDIT APPOINTMENT ──────────────────────────────────────────────
function editAppointment(id) {
  const newDate = prompt('Enter new date (YYYY-MM-DD):');
  if (!newDate) return;
  const newTime = prompt('Enter new time slot (e.g. 09:00):');
  if (!newTime) return;

  fetch('/appointment/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apt_date: newDate,
      apt_time: newTime,
      status:   'Pending'
    })
  })
  .then(function(res) {
    if (res.ok) {
      alert('Appointment updated.');
      loadAppointments();
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
  const formattedDate = aptDate ? new Date(aptDate).toISOString().split('T')[0] : '';
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
        alert('Appointment booked! ID: #' + data.appointment_id);
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
        alert('Appointment cancelled.');
        loadAppointments();
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

// ── LOAD RECORDS ──────────────────────────────────────────────────
function loadRecords() {
  const container = document.getElementById('recordsContainer');
  if (!container) return;

  const cid = sessionStorage.getItem('userCid');
  if (!cid) { container.innerHTML = '<p style="color:var(--text-muted)">Session expired.</p>'; return; }

  fetch('/patient/records/' + cid)
    .then(function(res) {
      if (!res.ok) { container.innerHTML = '<p style="color:var(--text-muted)">No records found.</p>'; return null; }
      return res.json();
    })
    .then(function(records) {
      if (!records) return;
      if (records.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted)">No medical records yet.</p>';
        return;
      }
      container.innerHTML = records.map(function(r) {
        const prescriptions = (r.prescriptions || []).join(', ') || '-';
        return '<div class="card" style="margin-bottom:16px">' +
          '<p><strong>Record ID:</strong> REC-' + r.record_id + '</p>' +
          '<p><strong>Date:</strong> ' + (r.record_date || '-') + '</p>' +
          '<p><strong>Diagnosis:</strong> ' + (r.diagnosis || '-') + '</p>' +
          '<p><strong>Treatment:</strong> ' + (r.treatment || '-') + '</p>' +
          '<p><strong>Doctor\'s Notes:</strong> ' + (r.doctor_notes || '-') + '</p>' +
          '<p style="margin-top:10px"><strong>Prescriptions:</strong> ' + prescriptions + '</p>' +
          '</div>';
      }).join('');
    })
    .catch(function() {
      container.innerHTML = '<p style="color:var(--text-muted)">Could not load records.</p>';
    });
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
      const set = function(id, val) { const el = document.getElementById(id); if (el && val) el.value = val; };
      set('profileName',      u.name);
      set('profileCid',       u.cid);
      set('profileDzongkhag', u.dzongkhag);
      set('profilePhone',     u.phone_no);
      set('profileGender',    u.gender);
      set('profileDob',       u.dob);
    })
    .catch(function(e) { console.error('Could not load profile:', e); });
}

// ── SAVE PROFILE ──────────────────────────────────────────────────
function saveProfile(e) {
  e.preventDefault();
  const cid = sessionStorage.getItem('userCid');
  const payload = {
    name:      document.getElementById('profileName') ? document.getElementById('profileName').value : '',
    dzongkhag: document.getElementById('profileDzongkhag') ? document.getElementById('profileDzongkhag').value : '',
    phone_no:  document.getElementById('profilePhone') ? document.getElementById('profilePhone').value : '',
    gender:    document.getElementById('profileGender') ? document.getElementById('profileGender').value : '',
    dob:       document.getElementById('profileDob') ? document.getElementById('profileDob').value : ''
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

// ── RESIZE HANDLER ────────────────────────────────────────────────
window.addEventListener('resize', function() {
  const active = document.querySelector('.page-section.active');
  if (active) showPage(active.id, null);
});

// ── INIT ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  console.log('init running, cid:', sessionStorage.getItem('userCid'));
  const cid = sessionStorage.getItem('userCid');
  if (!cid) { window.location.href = 'login.html'; return; }

  const overlay = document.getElementById('logoutOverlay');
  if (overlay) overlay.addEventListener('click', function(e) { if (e.target === overlay) closeLogout(); });

  const apptForm = document.getElementById('appointmentForm');
  if (apptForm) apptForm.addEventListener('submit', bookAppointment);

  const profileForm = document.getElementById('profileForm');
  if (profileForm) profileForm.addEventListener('submit', saveProfile);

  loadChambers();
  showPage('dashboard', null, 'Home');
  showNavHint();
});