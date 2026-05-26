package model

import "hospitalOPD/dataStore/postgres"

// CountUsers returns the total number of registered patients
func CountUsers(dest *int) error {
	return postgres.Db.QueryRow("SELECT COUNT(*) FROM users").Scan(dest)
}

// CountDoctors returns the total number of doctors
func CountDoctors(dest *int) error {
	return postgres.Db.QueryRow("SELECT COUNT(*) FROM doctors").Scan(dest)
}

// CountChambers returns the total number of chambers
func CountChambers(dest *int) error {
	return postgres.Db.QueryRow("SELECT COUNT(*) FROM chambers").Scan(dest)
}

// CountTodayAppointments returns the number of appointments scheduled for today
func CountTodayAppointments(dest *int) error {
	return postgres.Db.QueryRow(
		"SELECT COUNT(*) FROM appointments WHERE appointment_date = CURRENT_DATE",
	).Scan(dest)
}

// CountAllAppointments returns the total number of appointments ever booked
func CountAllAppointments(dest *int) error {
	return postgres.Db.QueryRow("SELECT COUNT(*) FROM appointments").Scan(dest)
}