package model

import (
	"hospitalOPD/dataStore/postgres"
)

// Appointment represents a row in the appointments table
type Appointment struct {
	AptId     int64  `json:"appointment_id"`
	AptDate   string `json:"apt_date"`
	AptTime   string `json:"apt_time"`
	ChamberNo int64  `json:"chamber_no"`
	Cid       string `json:"cid"`
	AdminId   int    `json:"admin_id"`
	Status    string `json:"status"`
	Name      string `json:"name"`
}

const queryInsertApt = `
	INSERT INTO appointments (appointment_date, appointment_time, chamber_no, CID, admin_id, status)
	VALUES ($1, $2, $3, $4, $5, $6)
	RETURNING appointment_id;`

func (app *Appointment) Create() error {
	var adminId interface{}
	if app.AdminId != 0 {
		adminId = app.AdminId
	}
	return postgres.Db.QueryRow(
		queryInsertApt,
		app.AptDate, app.AptTime, app.ChamberNo, app.Cid, adminId, app.Status,
	).Scan(&app.AptId)
}

const queryUpdateApt = `
	UPDATE appointments
	SET appointment_date = $1, appointment_time = $2, chamber_no = $3, CID = $4, admin_id = $5, status = $6
	WHERE appointment_id = $7
	RETURNING appointment_id;`

func (app *Appointment) Update(oldAptId int64) error {
	return postgres.Db.QueryRow(
		queryUpdateApt,
		app.AptDate, app.AptTime, app.ChamberNo, app.Cid, app.AdminId, app.Status, oldAptId,
	).Scan(&app.AptId)
}

const queryDeleteApt = `
	DELETE FROM appointments
	WHERE appointment_id = $1
	RETURNING appointment_id;`

func (app *Appointment) Delete() error {
	return postgres.Db.QueryRow(queryDeleteApt, app.AptId).Scan(&app.AptId)
}

const queryGetApt = `
	SELECT a.appointment_id, u.name, a.appointment_date, a.appointment_time, a.chamber_no, a.status
	FROM appointments a
	JOIN users u ON a.CID = u.CID
	WHERE a.appointment_id = $1;`

func (app *Appointment) Read() error {
	return postgres.Db.QueryRow(queryGetApt, app.AptId).Scan(
		&app.AptId, &app.Name, &app.AptDate, &app.AptTime, &app.ChamberNo, &app.Status,
	)
}

const queryGetAll = `
	SELECT a.appointment_id, u.name, a.appointment_date, a.appointment_time, a.chamber_no, a.CID, a.status
	FROM appointments a
	JOIN users u ON a.CID = u.CID
	ORDER BY a.appointment_date, a.appointment_time;`

func ReadAll() ([]Appointment, error) {
	rows, err := postgres.Db.Query(queryGetAll)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var appointments []Appointment
	for rows.Next() {
		var app Appointment
		if err := rows.Scan(&app.AptId, &app.Name, &app.AptDate, &app.AptTime, &app.ChamberNo, &app.Cid, &app.Status); err != nil {
			return nil, err
		}
		appointments = append(appointments, app)
	}
	return appointments, nil
}

const queryGetByDate = `
	SELECT a.appointment_id, u.name, a.appointment_date, a.appointment_time, a.chamber_no, a.status
	FROM appointments a
	JOIN users u ON a.CID = u.CID
	WHERE a.appointment_date = $1
	ORDER BY a.appointment_time;`

func ReadByDate(date string) ([]Appointment, error) {
	rows, err := postgres.Db.Query(queryGetByDate, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var appointments []Appointment
	for rows.Next() {
		var app Appointment
		if err := rows.Scan(&app.AptId, &app.Name, &app.AptDate, &app.AptTime, &app.ChamberNo, &app.Status); err != nil {
			return nil, err
		}
		appointments = append(appointments, app)
	}
	return appointments, nil
}

const queryGetBookedSlots = `
	SELECT appointment_time
	FROM appointments
	WHERE chamber_no = $1
	AND appointment_date = $2
	AND status != 'Cancelled';`

func ReadBookedSlots(chamberNo int64, date string) ([]string, error) {
	rows, err := postgres.Db.Query(queryGetBookedSlots, chamberNo, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var slots []string
	for rows.Next() {
		var slot string
		if err := rows.Scan(&slot); err != nil {
			return nil, err
		}
		slots = append(slots, slot)
	}
	return slots, nil
}

const queryGetByChamber = `
	SELECT a.appointment_id, u.name, a.appointment_date, a.appointment_time, a.chamber_no, a.CID, a.status
	FROM appointments a
	JOIN users u ON a.CID = u.CID
	WHERE a.chamber_no = $1
	ORDER BY a.appointment_date, a.appointment_time;`

func ReadAppointmentsByChamber(chamberNo int) ([]Appointment, error) {
	rows, err := postgres.Db.Query(queryGetByChamber, chamberNo)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var appointments []Appointment
	for rows.Next() {
		var app Appointment
		if err := rows.Scan(&app.AptId, &app.Name, &app.AptDate, &app.AptTime, &app.ChamberNo, &app.Cid, &app.Status); err != nil {
			return nil, err
		}
		appointments = append(appointments, app)
	}
	return appointments, nil
}

const queryGetByChamberAndDate = `
	SELECT a.appointment_id, u.name, a.appointment_date, a.appointment_time, a.chamber_no, a.CID, a.status
	FROM appointments a
	JOIN users u ON a.CID = u.CID
	WHERE a.chamber_no = $1 AND a.appointment_date = $2
	ORDER BY a.appointment_time;`

func ReadChamberAppointmentsByDate(chamberNo int, date string) ([]Appointment, error) {
	rows, err := postgres.Db.Query(queryGetByChamberAndDate, chamberNo, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var appointments []Appointment
	for rows.Next() {
		var app Appointment
		if err := rows.Scan(&app.AptId, &app.Name, &app.AptDate, &app.AptTime, &app.ChamberNo, &app.Cid, &app.Status); err != nil {
			return nil, err
		}
		appointments = append(appointments, app)
	}
	return appointments, nil
}

const queryGetByPatient = `
	SELECT a.appointment_id, u.name, a.appointment_date, a.appointment_time, a.chamber_no, a.CID, a.status
	FROM appointments a
	JOIN users u ON a.CID = u.CID
	WHERE a.CID = $1
	ORDER BY a.appointment_date DESC;`

func ReadAppointmentsByPatient(cid string) ([]Appointment, error) {
	rows, err := postgres.Db.Query(queryGetByPatient, cid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var appointments []Appointment
	for rows.Next() {
		var app Appointment
		if err := rows.Scan(&app.AptId, &app.Name, &app.AptDate, &app.AptTime, &app.ChamberNo, &app.Cid, &app.Status); err != nil {
			return nil, err
		}
		appointments = append(appointments, app)
	}
	return appointments, nil
}

const queryUpdateAptStatus = `
	UPDATE appointments
	SET status = $1
	WHERE appointment_id = $2
	RETURNING appointment_id;`

func UpdateAppointmentStatus(aptId int64, status string) error {
	var id int64
	return postgres.Db.QueryRow(queryUpdateAptStatus, status, aptId).Scan(&id)
}