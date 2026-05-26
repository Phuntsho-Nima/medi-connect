package model

import (
	"hospitalOPD/dataStore/postgres"
)

// Chamber represents a row in the chambers table
type Chamber struct {
	ChamberNo          int    `json:"chamberNo"`
	ChamberName        string `json:"chamberName"`
	AvailabilityStatus string `json:"availabilityStatus"`
	DepartmentId       int    `json:"departmentId"`
	DepartmentName     string `json:"departmentName"` // joined from departments table
	DoctorCount        int    `json:"doctorCount"`    // count of assigned doctors
}

// Create inserts a new chamber and returns the generated chamber_no
const queryInsertChamber = `
	INSERT INTO chambers (chamber_name, availability_status, department_id)
	VALUES ($1, $2, $3)
	RETURNING chamber_no;`

func (c *Chamber) Create() error {
	// Default to Available if not set
	if c.AvailabilityStatus == "" {
		c.AvailabilityStatus = "Available"
	}
	return postgres.Db.QueryRow(
		queryInsertChamber,
		c.ChamberName, c.AvailabilityStatus, c.DepartmentId,
	).Scan(&c.ChamberNo)
}

// Read fetches a single chamber by ID joined with department name and doctor count
const queryGetChamberById = `
	SELECT c.chamber_no, c.chamber_name, c.availability_status, c.department_id,
		COALESCE(dep.department_name, '') as department_name,
		COUNT(cd.doctor_id) as doctor_count
	FROM chambers c
	LEFT JOIN departments dep ON c.department_id = dep.department_id
	LEFT JOIN chamber_doctors cd ON c.chamber_no = cd.chamber_no
	WHERE c.chamber_no = $1
	GROUP BY c.chamber_no, c.chamber_name, c.availability_status, c.department_id, dep.department_name;`

func (c *Chamber) Read() error {
	return postgres.Db.QueryRow(queryGetChamberById, c.ChamberNo).Scan(
		&c.ChamberNo, &c.ChamberName, &c.AvailabilityStatus,
		&c.DepartmentId, &c.DepartmentName, &c.DoctorCount,
	)
}

// Update modifies a chamber's details
const queryUpdateChamber = `
	UPDATE chambers
	SET chamber_name = $1, availability_status = $2, department_id = $3
	WHERE chamber_no = $4
	RETURNING chamber_no;`

func (c *Chamber) Update() error {
	return postgres.Db.QueryRow(
		queryUpdateChamber,
		c.ChamberName, c.AvailabilityStatus, c.DepartmentId, c.ChamberNo,
	).Scan(&c.ChamberNo)
}

// Delete removes a chamber by ID
const queryDeleteChamber = `
	DELETE FROM chambers
	WHERE chamber_no = $1
	RETURNING chamber_no;`

func (c *Chamber) Delete() error {
	return postgres.Db.QueryRow(queryDeleteChamber, c.ChamberNo).Scan(&c.ChamberNo)
}

// ReadAll fetches all chambers with department name and assigned doctor count
const queryGetAllChambers = `
	SELECT c.chamber_no, c.chamber_name, c.availability_status, c.department_id,
		COALESCE(dep.department_name, '') as department_name,
		COUNT(cd.doctor_id) as doctor_count
	FROM chambers c
	LEFT JOIN departments dep ON c.department_id = dep.department_id
	LEFT JOIN chamber_doctors cd ON c.chamber_no = cd.chamber_no
	GROUP BY c.chamber_no, c.chamber_name, c.availability_status, c.department_id, dep.department_name
	ORDER BY c.chamber_no;`

func ReadAllChambers() ([]Chamber, error) {
	rows, err := postgres.Db.Query(queryGetAllChambers)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var chambers []Chamber
	for rows.Next() {
		var c Chamber
		if err := rows.Scan(
			&c.ChamberNo, &c.ChamberName, &c.AvailabilityStatus,
			&c.DepartmentId, &c.DepartmentName, &c.DoctorCount,
		); err != nil {
			return nil, err
		}
		chambers = append(chambers, c)
	}
	return chambers, nil
}

// ReadAvailableChambers fetches only chambers with status 'Available'
// Used by patients when booking appointments
const queryGetAvailableChambers = `
	SELECT c.chamber_no, c.chamber_name, c.department_id,
		COALESCE(dep.department_name, '') as department_name
	FROM chambers c
	LEFT JOIN departments dep ON c.department_id = dep.department_id
	WHERE c.availability_status = 'Available'
	ORDER BY c.chamber_name;`

func ReadAvailableChambers() ([]Chamber, error) {
	rows, err := postgres.Db.Query(queryGetAvailableChambers)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var chambers []Chamber
	for rows.Next() {
		var c Chamber
		if err := rows.Scan(
			&c.ChamberNo, &c.ChamberName, &c.DepartmentId, &c.DepartmentName,
		); err != nil {
			return nil, err
		}
		chambers = append(chambers, c)
	}
	return chambers, nil
}

// AssignDoctor adds a doctor to a chamber in chamber_doctors table
const queryAssignDoctor = `
	INSERT INTO chamber_doctors (chamber_no, doctor_id)
	VALUES ($1, $2);`

func AssignDoctorToChamber(chamberNo int, doctorId int) error {
	_, err := postgres.Db.Exec(queryAssignDoctor, chamberNo, doctorId)
	return err
}

// RemoveDoctor removes a doctor from a chamber
const queryRemoveDoctor = `
	DELETE FROM chamber_doctors
	WHERE chamber_no = $1 AND doctor_id = $2;`

func RemoveDoctorFromChamber(chamberNo int, doctorId int) error {
	_, err := postgres.Db.Exec(queryRemoveDoctor, chamberNo, doctorId)
	return err
}

// ChamberExists checks if a chamber_no exists — used before assigning doctors
func ChamberExists(chamberNo int) (bool, error) {
	var count int
	err := postgres.Db.QueryRow(
		"SELECT COUNT(*) FROM chambers WHERE chamber_no = $1", chamberNo,
	).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// ReadChambersByDoctor fetches all chambers a doctor is assigned to
const queryGetChambersByDoctor = `
	SELECT c.chamber_no, c.chamber_name, c.availability_status,
		COALESCE(dep.department_name, '') as department_name
	FROM chambers c
	JOIN chamber_doctors cd ON c.chamber_no = cd.chamber_no
	LEFT JOIN departments dep ON c.department_id = dep.department_id
	WHERE cd.doctor_id = $1
	ORDER BY c.chamber_name;`

func ReadChambersByDoctor(doctorId int) ([]Chamber, error) {
	rows, err := postgres.Db.Query(queryGetChambersByDoctor, doctorId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var chambers []Chamber
	for rows.Next() {
		var c Chamber
		if err := rows.Scan(
			&c.ChamberNo, &c.ChamberName, &c.AvailabilityStatus, &c.DepartmentName,
		); err != nil {
			return nil, err
		}
		chambers = append(chambers, c)
	}
	return chambers, nil
}

// ReadChamberWithSlot checks if a specific time slot is still available
// Returns sql.ErrNoRows if slot is free, returns a row if already booked
func SlotAlreadyBooked(chamberNo int, date string, time string) (bool, error) {
	var count int
	err := postgres.Db.QueryRow(`
		SELECT COUNT(*) FROM appointments
		WHERE chamber_no = $1
		AND appointment_date = $2
		AND appointment_time = $3
		AND status != 'Cancelled'`,
		chamberNo, date, time,
	).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// PatientAlreadyBookedOnDate checks if a patient already has an appointment on a given date
func PatientAlreadyBookedOnDate(cid string, date string) (bool, error) {
	var count int
	err := postgres.Db.QueryRow(`
		SELECT COUNT(*) FROM appointments
		WHERE CID = $1
		AND appointment_date = $2
		AND status != 'Cancelled'`,
		cid, date,
	).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}





