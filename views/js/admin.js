/* admin.js – Admin dashboard logic, wired to Go backend */

const isMobile = () => window.innerWidth <= 750;

const pageTitles = {
  dashboard:    'Home',
  users:        'Users',
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
  const b = document.getElementById('bnav-' + pageId);
  if (b) b.classList.add('active');

  document.getElementById('mobilePageTitle').textContent = mobileTitle || pageTitles[pageId] || '';

  const m = isMobile();
  document.querySelectorAll('.desktop-table').forEach(function(el) { el.style.display = m ? 'none' : 'block'; });
  document.querySelectorAll('.mobile-card-list').forEach(function(el) { el.style.display = m ? 'block' : 'none'; });

  if (pageId === 'dashboard')    loadAdminDashboard();
  if (pageId === 'appointments') loadAllAppointments();
  if (pageId === 'users')        loadAllUsers();
  if (pageId === 'doctors')      loadAllDoctors();
}

function showNavHint() {
  if (!isMobile() || sessionStorage.getItem('adminHint')) return;
  const h = document.getElementById('navHint');
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
    .catch(function() { /* ignore */ })
    .finally(function() {
      closeLogout();
      window.location.href = 'login.html';
    });
}

// ── LOAD ADMIN DASHBOARD ──────────────────────────────────────────
function loadAdminDashboard() {
  fetch('/admin/dashboard')
    .then(function(res) {
      if (!res.ok) return null;
      return res.json();
    })
    .then(function(d) {
      if (!d) return;
      const set = function(sel, val) {
        const el = document.querySelector(sel);
        if (el && val !== undefined) el.textContent = val;
      };
      set('.stat-card.purple h4', d.total_users        || 0);
      set('.stat-card.blue h4',   d.total_doctors       || 0);
      set('.stat-card.amber h4',  d.appointments_today  || 0);

      const name = sessionStorage.getItem('userName') || 'Admin';
      const h2 = document.querySelector('.welcome-desktop h2');
      if (h2) h2.textContent = 'Welcome, Admin ' + name + '!';

      setTimeout(animateBars, 300);
    })
    .catch(function(e) { console.error('Dashboard load error:', e); });
}

// ── LOAD ALL APPOINTMENTS ─────────────────────────────────────────
function loadAllAppointments() {
  fetch('/admin/appointments')
    .then(function(res) {
      if (!res.ok) return null;
      return res.json();
    })
    .then(function(apts) {
      renderAdminAppointments(apts || []);
    })
    .catch(function(e) { console.error('Appointments load error:', e); });
}

function statusBadgeClass(status) {
  if (!status) return 'status-on';
  const s = status.toLowerCase();
  if (s === 'confirmed' || s === 'approved') return 'status-on';
  if (s === 'pending')   return 'status-pending';
  if (s === 'cancelled') return 'status-off';
  return 'status-on';
}

function renderAdminAppointments(apts) {
  const tb = document.querySelector('#appointments tbody');
  const ml = document.querySelector('#appointments .mobile-card-list');

  if (!apts || apts.length === 0) {
    if (tb) tb.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:32px">No appointments found</td></tr>';
    if (ml) ml.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:24px 0">No appointments found</p>';
    return;
  }

  if (tb) {
    tb.innerHTML = apts.map(function(a) {
      return '<tr id="aprow-' + a.appointment_id + '">' +
        '<td>#' + a.appointment_id + '</td>' +
        '<td>' + (a.name || '-') + '</td>' +
        '<td>' + (a.cid || '-') + '</td>' +
        '<td>' + (a.doctor_name || '-') + '</td>' +
        '<td>' + (a.department || '-') + '</td>' +
        '<td>' + (a.apt_date || '-') + '</td>' +
        '<td><span class="badge ' + statusBadgeClass(a.status) + '">' + (a.status || 'Pending') + '</span></td>' +
        '<td>' +
          (a.status === 'Pending'
            ? '<button class="btn-small btn-activate" onclick="approveAppt(' + a.appointment_id + ')">Approve</button> '
            : '') +
          (a.status !== 'Cancelled'
            ? '<button class="btn-small btn-deact" onclick="cancelAppt(' + a.appointment_id + ')">Cancel</button>'
            : '<span style="color:var(--text-muted);font-size:0.8rem">Cancelled</span>') +
        '</td>' +
        '</tr>';
    }).join('');
  }

  if (ml) {
    ml.innerHTML = apts.map(function(a) {
      return '<div class="note-card" style="border:1px solid var(--border)">' +
        '<div class="note-card-header">' +
          '<strong>#' + a.appointment_id + ' — ' + (a.name || 'Patient') + '</strong>' +
          '<span class="badge ' + statusBadgeClass(a.status) + '">' + (a.status || 'Pending') + '</span>' +
        '</div>' +
        '<p>' + (a.doctor_name || 'Doctor') + ' · ' + (a.department || '-') + ' · ' + (a.apt_date || '-') + '</p>' +
        '<div style="margin-top:8px;display:flex;gap:8px">' +
          (a.status === 'Pending'
            ? '<button class="btn-small btn-activate" onclick="approveAppt(' + a.appointment_id + ')">Approve</button>'
            : '') +
          (a.status !== 'Cancelled'
            ? '<button class="btn-small btn-deact" onclick="cancelAppt(' + a.appointment_id + ')">Cancel</button>'
            : '') +
        '</div>' +
        '</div>';
    }).join('');
  }
}

// ── APPROVE / CANCEL APPOINTMENT ──────────────────────────────────
function approveAppt(id) {
  fetch('/admin/appointment/' + id + '/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Confirmed' })
  })
  .then(function(res) {
    if (!res.ok) { alert('Could not approve appointment.'); return; }
    const row = document.getElementById('aprow-' + id);
    if (row) {
      const badge = row.querySelector('.badge');
      if (badge) { badge.className = 'badge status-on'; badge.textContent = 'Confirmed'; }
      const appBtn = row.querySelector('.btn-activate');
      if (appBtn) appBtn.remove();
    }
  })
  .catch(function() { alert('Network error.'); });
}

function cancelAppt(id) {
  if (!confirm('Cancel appointment #' + id + '?')) return;
  fetch('/admin/appointment/' + id, { method: 'DELETE' })
    .then(function(res) {
      if (res.ok) loadAllAppointments();
      else alert('Could not cancel appointment.');
    })
    .catch(function() { alert('Network error.'); });
}

// ── LOAD ALL USERS ────────────────────────────────────────────────
function loadAllUsers() {
  fetch('/admin/users')
    .then(function(res) {
      if (!res.ok) return null;
      return res.json();
    })
    .then(function(users) {
      renderUsers(users || []);
    })
    .catch(function(e) { console.error('Users load error:', e); });
}

function renderUsers(users) {
  const tb = document.querySelector('#users tbody');
  if (!tb) return;
  if (users.length === 0) {
    tb.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:32px">No users found</td></tr>';
    return;
  }
  tb.innerHTML = users.map(function(u, i) {
    return '<tr id="urow-' + u.cid + '">' +
      '<td>USR-' + String(i + 1).padStart(3, '0') + '</td>' +
      '<td>' + (u.name || '-') + '</td>' +
      '<td>' + (u.cid || '-') + '</td>' +
      '<td><span class="role-badge role-patient">Patient</span></td>' +
      '<td>' + (u.phone_no || '-') + '</td>' +
      '<td><span class="badge status-active">Active</span></td>' +
      '<td>' +
        '<button class="btn-small btn-edit" onclick="editUser(\'' + u.cid + '\')">Edit</button> ' +
        '<button class="btn-small btn-deact" onclick="deleteUser(\'' + u.cid + '\')">Delete</button>' +
      '</td>' +
      '</tr>';
  }).join('');
}

// ── USER ACTIONS ──────────────────────────────────────────────────
function editUser(cid) { alert('Edit user CID: ' + cid); }

function deleteUser(cid) {
  if (!confirm('Delete user ' + cid + '? This cannot be undone.')) return;
  fetch('/admin/user/' + cid, { method: 'DELETE' })
    .then(function(res) {
      if (res.ok) loadAllUsers();
      else alert('Could not delete user.');
    })
    .catch(function() { alert('Network error.'); });
}

// ── ADD DOCTOR ────────────────────────────────────────────────────
function addDoctor(e) {
  e.preventDefault();
  const name          = document.getElementById('newDoctorName') ? document.getElementById('newDoctorName').value : '';
  const specialization = document.getElementById('newDoctorSpec') ? document.getElementById('newDoctorSpec').value : '';
  const department_id  = parseInt(document.getElementById('newDoctorDept') ? document.getElementById('newDoctorDept').value : 0);
  const password       = document.getElementById('newDoctorPass') ? document.getElementById('newDoctorPass').value : '';

  if (!name || !password) { alert('Name and password are required.'); return; }

  fetch('/admin/doctor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name, specialization: specialization, department_id: department_id, password: password })
  })
  .then(function(res) {
    return res.json().then(function(data) {
      if (res.ok) {
        alert('Doctor added! ID: ' + data.doctorId);
        e.target.reset();
        loadAllDoctors();
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
    .then(function(res) {
      if (!res.ok) return null;
      return res.json();
    })
    .then(function(doctors) {
      const tb = document.querySelector('#doctors tbody');
      if (!tb) return;
      tb.innerHTML = (doctors || []).map(function(d) {
        return '<tr>' +
          '<td>' + d.doctor_id + '</td>' +
          '<td>' + (d.name || '-') + '</td>' +
          '<td>' + (d.specialization || '-') + '</td>' +
          '<td>' + (d.department_name || '-') + '</td>' +
          '<td><button class="btn-small btn-deact" onclick="deleteDoctor(' + d.doctor_id + ')">Remove</button></td>' +
          '</tr>';
      }).join('');
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
function saveSettings(e) {
  e.preventDefault();
  alert('Settings saved.');
}

// ── BAR CHART ANIMATION ───────────────────────────────────────────
function animateBars() {
  document.querySelectorAll('.bar-fill[data-w]').forEach(function(b) { b.style.width = b.dataset.w; });
}

// ── RESIZE ────────────────────────────────────────────────────────
window.addEventListener('resize', function() {
  const a = document.querySelector('.page-section.active');
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

      const ov = document.getElementById('logoutOverlay');
      if (ov) ov.addEventListener('click', function(e) { if (e.target === ov) closeLogout(); });

      const sf = document.getElementById('settingsForm');
      if (sf) sf.addEventListener('submit', saveSettings);

      const addDoctorForm = document.getElementById('addDoctorForm');
      if (addDoctorForm) addDoctorForm.addEventListener('submit', addDoctor);

      showPage('dashboard', null, 'Home');
      showNavHint();
    })
    .catch(function(err) { console.error('Admin dashboard network error:', err); window.location.href = 'login.html'; });
});