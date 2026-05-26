/* doctor.js – Doctor dashboard logic, wired to Go backend */

const isMobile = () => window.innerWidth <= 750;

const pageTitles = {
  dashboard:     'Home',
  patients:      'My Patients',
  schedule:      'Schedule',
  prescriptions: 'Prescriptions',
  profile:       'Profile'
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

  if (pageId === 'dashboard')    loadDoctorDashboard();
  if (pageId === 'patients')     loadPatients();
  if (pageId === 'schedule')     loadSchedule();
  if (pageId === 'profile')      loadDoctorProfile();
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
      set('.stat-card.teal h4',  apts.length);
      const seen    = apts.filter(function(a) { return a.status === 'Completed'; }).length;
      const waiting = apts.filter(function(a) { return a.status !== 'Completed' && a.status !== 'Cancelled'; }).length;
      set('.stat-card.green h4', seen);
      set('.stat-card.blue h4',  waiting);

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

// ── VIEW PATIENT ──────────────────────────────────────────────────
function viewPatient(cid) {
  showPage('patients', null, 'My Patients');
  alert('Viewing patient CID: ' + cid);
}

// ── LOAD PATIENTS ─────────────────────────────────────────────────
function loadPatients() {
  const chamberId = sessionStorage.getItem('doctorChamber');
  if (!chamberId) return;

  fetch('/chambers/' + chamberId + '/appointments')
    .then(function(res) {
      if (!res.ok) return;
      return res.json();
    })
    .then(function(apts) {
      apts = apts || [];
      const tb = document.querySelector('#patients tbody');
      if (!tb) return;

      if (apts.length === 0) {
        tb.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:32px">No patients found</td></tr>';
        return;
      }
      tb.innerHTML = apts.map(function(a) {
        return '<tr>' +
          '<td>' + (a.cid || '-') + '</td>' +
          '<td>' + (a.name || '-') + '</td>' +
          '<td>-</td>' +
          '<td>' + (a.department || '-') + '</td>' +
          '<td>' + (a.apt_date || '-') + '</td>' +
          '<td>' + (a.status || '-') + '</td>' +
          '<td><button class="btn-small btn-view" onclick="viewPatient(\'' + a.cid + '\')">View Notes</button></td>' +
          '</tr>';
      }).join('');

      const ml = document.querySelector('#patients .mobile-card-list');
      if (ml && isMobile()) {
        ml.innerHTML = apts.map(function(a) {
          return '<div class="note-card">' +
            '<div class="note-card-header">' +
              '<strong>' + (a.name || 'Patient') + '</strong>' +
              '<span class="badge status-on">' + (a.department || '-') + '</span>' +
            '</div>' +
            '<p>CID ' + (a.cid || '-') + ' · ' + (a.apt_date || '-') + '</p>' +
            '</div>';
        }).join('');
      }
    })
    .catch(function(e) { console.error('Patients load error:', e); });
}

// ── LOAD SCHEDULE ─────────────────────────────────────────────────
function loadSchedule() {
  const chamberId = sessionStorage.getItem('doctorChamber');
  if (!chamberId) return;

  const today = new Date().toISOString().split('T')[0];
  fetch('/doctor/chamber/' + chamberId + '/appointments?date=' + today)
    .then(function(res) {
      if (!res.ok) return;
      return res.json();
    })
    .then(function(apts) {
      apts = apts || [];
      const container = document.getElementById('scheduleContainer');
      if (!container) return;

      const heading = container.previousElementSibling;
      if (heading && heading.tagName === 'H3') {
        const todayDisplay = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        heading.textContent = 'Today — ' + todayDisplay;
      }

      if (apts.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);padding:16px 0">No appointments scheduled today.</p>';
        return;
      }

      container.innerHTML = apts.map(function(a) {
        const done     = a.status === 'Completed';
        const badgeCls = done ? 'status-seen' : (a.status === 'Cancelled' ? 'status-off' : 'status-waiting');
        const badgeTxt = done ? 'Seen' : (a.status || 'Waiting');
        return '<div class="schedule-slot">' +
          '<div class="slot-time">' + (a.apt_time || '-') + '</div>' +
          '<div class="slot-patient">' +
            '<strong>' + (a.name || 'Patient') + '</strong>' +
            '<span>' + (a.department || '-') + ' · CH-' + chamberId + ' · CID ' + (a.cid || '-') + '</span>' +
          '</div>' +
          '<span class="badge ' + badgeCls + '">' + badgeTxt + '</span>' +
          '</div>';
      }).join('');
    })
    .catch(function(e) { console.error('Schedule load error:', e); });
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

// ── ISSUE PRESCRIPTION ────────────────────────────────────────────
function submitPrescription(e) {
  e.preventDefault();

  const cid   = document.getElementById('rxCidNo').value.trim();
  const drug  = document.getElementById('rxDrug').value.trim();
  const dose  = document.getElementById('rxDosage').value.trim();
  const notes = document.getElementById('rxNotes').value.trim();
  const name  = document.getElementById('rxPatientName').value.trim();

  if (!cid || !drug) {
    alert('Patient CID and drug name are required.');
    return;
  }

  fetch('/doctor/record', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cid:           cid,
      doctor_notes:  notes,
      prescriptions: [drug + ' — ' + dose]
    })
  })
  .then(function(res) {
    if (!res.ok) {
      return res.json().then(function(err) {
        alert('Error: ' + (err.error || 'Could not save record.'));
      });
    }
    return res.json().then(function() {
      const list = document.getElementById('rxList');
      if (list) {
        const pill = document.createElement('div');
        pill.className = 'rx-pill';
        pill.innerHTML = '<i class="fas fa-prescription-bottle-alt"></i>' + name + ' — ' + drug + ' ' + dose;
        list.prepend(pill);
      }
      alert('Prescription saved for ' + name + ': ' + drug + ' ' + dose);
      e.target.reset();
    });
  })
  .catch(function(err) {
    console.error('Prescription error:', err);
    alert('Network error. Could not save prescription.');
  });
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

      const rx = document.getElementById('prescriptionForm');
      if (rx) rx.addEventListener('submit', submitPrescription);

      showPage('dashboard', null, 'Home');
      showNavHint();
    })
    .catch(function(err) {
      console.error('Doctor dashboard network error:', err);
      window.location.href = 'login.html';
    });
});