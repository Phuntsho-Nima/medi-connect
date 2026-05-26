// Shared mobile navigation logic
(function() {
  // Auth guard for patient pages
  var patientPages = ['index.html','appointments.html','records.html','profile.html','chambers.html'];
  var _file = window.location.pathname.split('/').pop() || 'index.html';
  if (patientPages.indexOf(_file) !== -1 && !sessionStorage.getItem('userCid')) {
    window.location.href = 'login.html';
  }

  var PAGE_META = {
    'index.html':        { id: 'bnav-dashboard',    title: 'Home' },
    'appointments.html': { id: 'bnav-appointments', title: 'Book' },
    'records.html':      { id: 'bnav-records',      title: 'Records' },
    'profile.html':      { id: 'bnav-profile',      title: 'Profile' }
  };

  function getCurrentPage() {
    var path = window.location.pathname;
    var file = path.split('/').pop() || 'index.html';
    if (file === '' || file === '/') file = 'index.html';
    return file;
  }

  function initNav() {
    var current = getCurrentPage();
    var meta = PAGE_META[current];
    if (meta) {
      var el = document.getElementById(meta.id);
      if (el) el.classList.add('active');
      var titleEl = document.getElementById('mobilePageTitle');
      if (titleEl) titleEl.textContent = meta.title;
    }
  }

  function showNavHint() {
    if (window.innerWidth > 750) return;
    if (sessionStorage.getItem('hintShown')) return;
    var hint = document.getElementById('navHint');
    if (!hint) return;
    hint.style.display = 'block';
    sessionStorage.setItem('hintShown', '1');
    setTimeout(function() {
      hint.style.transition = 'opacity 0.5s';
      hint.style.opacity = '0';
      setTimeout(function() { hint.style.display = 'none'; }, 500);
    }, 3000);
  }

  window.confirmLogout = function() {
    document.getElementById('logoutOverlay').classList.add('active');
  };
  window.closeLogout = function() {
    document.getElementById('logoutOverlay').classList.remove('active');
  };
  window.doLogout = function() {
    fetch('/user/logout', { method: 'POST' })
      .catch(function() { /* ignore */ })
      .finally(function() {
        sessionStorage.removeItem('userRole');
        sessionStorage.removeItem('userCid');
        sessionStorage.removeItem('userName');
        sessionStorage.removeItem('adminId');
        sessionStorage.removeItem('doctorId');
        sessionStorage.removeItem('doctorChamber');
        closeLogout();
        window.location.href = 'login.html';
      });
  };

  window.addEventListener('load', function() {
    initNav();
    showNavHint();
    var overlay = document.getElementById('logoutOverlay');
    if (overlay) {
      overlay.addEventListener('click', function(e) {
        if (e.target === this) closeLogout();
      });
    }
  });
})();
