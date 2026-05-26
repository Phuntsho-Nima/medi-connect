let appointments = JSON.parse(localStorage.getItem("appointments")) || [];
let appointmentCounter = appointments.length > 0 ? Math.max(...appointments.map(a => a.id)) + 1 : 8822;

document.addEventListener("DOMContentLoaded", function() {
  const form = document.getElementById("appointmentForm");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const patientName = document.getElementById("patientName").value;
      const appointmentDate = document.getElementById("appointmentDate").value;
      const appointmentTime = document.getElementById("appointmentTime").value;
      const chamber = document.getElementById("chamber").value;
      const department = document.getElementById("department").value;

      const appointment = {
        id: appointmentCaounter++,
        patientName, date: appointmentDate, time: appointmentTime,
        chamber, department, status: "Scheduled",
        registeredAt: new Date().toLocaleString(),
      };

      appointments.push(appointment);
      localStorage.setItem("appointments", JSON.stringify(appointments));
      alert(`Appointment registered successfully!\nAppointment ID: #${appointment.id}`);
      form.reset();
      displayAppointments();
    });
  }

  displayAppointments();
});

function displayAppointments() {
  const tableBody = document.getElementById("appointmentTableBody");
  const mobileList = document.getElementById("mobileApptList");

  if (appointments.length === 0) {
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No appointments registered yet</td></tr>';
    if (mobileList) mobileList.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:24px 0">No appointments yet</p>';
    return;
  }

  if (tableBody) {
    tableBody.innerHTML = appointments.map((apt) => `
      <tr>
        <td data-label="ID">#${apt.id}</td>
        <td data-label="Patient Name">${apt.patientName}</td>
        <td data-label="Date">${apt.date}</td>
        <td data-label="Time">${apt.time}</td>
        <td data-label="Chamber">${apt.chamber || apt.department || ''}</td>
        <td data-label="Status"><span class="badge status-on">${apt.status}</span></td>
        <td data-label="Action"><button class="btn-small" onclick="cancelAppointment(${apt.id})">Cancel</button></td>
      </tr>
    `).join("");
  }

  if (mobileList) {
    mobileList.innerHTML = appointments.map((apt) => `
      <div class="appt-card">
        <div class="appt-card-header">
          <strong>${apt.patientName}</strong>
          <span class="badge status-on">${apt.status}</span>
        </div>
        <div class="appt-card-body">
          <div class="appt-info-item"><span class="info-label">Date</span><span class="info-value">${apt.date}</span></div>
          <div class="appt-info-item"><span class="info-label">Time</span><span class="info-value">${apt.time}</span></div>
          <div class="appt-info-item"><span class="info-label">Chamber</span><span class="info-value">${apt.chamber || '-'}</span></div>
          <div class="appt-info-item"><span class="info-label">Dept</span><span class="info-value">${apt.department}</span></div>
        </div>
        <button class="btn-small" style="width:100%" onclick="cancelAppointment(${apt.id})">
          <i class="fas fa-times" style="margin-right:6px"></i>Cancel
        </button>
      </div>
    `).join("");
  }
}

function cancelAppointment(id) {
  if (confirm("Are you sure you want to cancel this appointment?")) {
    appointments = appointments.filter((apt) => apt.id !== id);
    localStorage.setItem("appointments", JSON.stringify(appointments));
    displayAppointments();
    alert("Appointment cancelled successfully!");
  }
}
