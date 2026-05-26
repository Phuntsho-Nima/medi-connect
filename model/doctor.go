package model

import (
	"database/sql"
	"hospitalOPD/dataStore/postgres"
)

type Doctor struct {
	DoctorId       int    `json:"doctor_id"`
	Name           string `json:"name"`
	Specialization string `json:"specialization"`
	DepartmentId   int    `json:"department_id"`
	DepartmentName string `json:"department_name"`
	ChamberNo      int    `json:"chamber_no"`
	ChamberName    string `json:"chamber_name"`
	Password       string `json:"password,omitempty"`
}

const queryInsertDoctor = `
	INSERT INTO doctors (name, specialization, department_id, password)
	VALUES ($1, $2, $3, $4)
	RETURNING doctor_id;`

func (d *Doctor) Create() error {
	var deptId interface{}
	if d.DepartmentId != 0 {
		deptId = d.DepartmentId
	}
	return postgres.Db.QueryRow(
		queryInsertDoctor,
		d.Name, d.Specialization, deptId, d.Password,
	).Scan(&d.DoctorId)
}

const queryInsertDoctorWithId = `
	INSERT INTO doctors (doctor_id, name, specialization, department_id, password)
	VALUES ($1, $2, $3, $4, $5)
	RETURNING doctor_id;`

func (d *Doctor) CreateWithManualId() error {
	var deptId interface{}
	if d.DepartmentId != 0 {
		deptId = d.DepartmentId
	}
	return postgres.Db.QueryRow(
		queryInsertDoctorWithId,
		d.DoctorId, d.Name, d.Specialization, deptId, d.Password,
	).Scan(&d.DoctorId)
}

const queryGetDoctorById = `
	SELECT d.doctor_id, d.name, d.specialization, d.department_id, COALESCE(dep.department_name, '') as department_name
	FROM doctors d
	LEFT JOIN departments dep ON d.department_id = dep.department_id
	WHERE d.doctor_id = $1;`

func (d *Doctor) Read() error {
	return postgres.Db.QueryRow(queryGetDoctorById, d.DoctorId).Scan(
		&d.DoctorId, &d.Name, &d.Specialization, &d.DepartmentId, &d.DepartmentName,
	)
}

const queryUpdateDoctor = `
	UPDATE doctors SET name = $1, specialization = $2, department_id = $3
	WHERE doctor_id = $4 RETURNING doctor_id;`

func (d *Doctor) Update() error {
	var deptId interface{}
	if d.DepartmentId != 0 {
		deptId = d.DepartmentId
	}
	return postgres.Db.QueryRow(
		queryUpdateDoctor,
		d.Name, d.Specialization, deptId, d.DoctorId,
	).Scan(&d.DoctorId)
}

const queryDeleteDoctor = `
	DELETE FROM doctors WHERE doctor_id = $1 RETURNING doctor_id;`

func (d *Doctor) Delete() error {
	return postgres.Db.QueryRow(queryDeleteDoctor, d.DoctorId).Scan(&d.DoctorId)
}

const queryGetAllDoctors = `
	SELECT d.doctor_id, d.name, d.specialization, d.department_id,
	       COALESCE(dep.department_name, '') AS department_name,
	       COALESCE(ch.chamber_no, 0)        AS chamber_no,
	       COALESCE(ch.chamber_name, '')     AS chamber_name
	FROM doctors d
	LEFT JOIN departments dep ON d.department_id = dep.department_id
	LEFT JOIN LATERAL (
	    SELECT c.chamber_no, c.chamber_name
	    FROM chamber_doctors cd
	    JOIN chambers c ON cd.chamber_no = c.chamber_no
	    WHERE cd.doctor_id = d.doctor_id
	    LIMIT 1
	) ch ON true
	ORDER BY d.name;`

func ReadAllDoctors() ([]Doctor, error) {
	rows, err := postgres.Db.Query(queryGetAllDoctors)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var doctors []Doctor
	for rows.Next() {
		var d Doctor
		if err := rows.Scan(&d.DoctorId, &d.Name, &d.Specialization, &d.DepartmentId, &d.DepartmentName, &d.ChamberNo, &d.ChamberName); err != nil {
			return nil, err
		}
		doctors = append(doctors, d)
	}
	return doctors, nil
}

const queryGetDoctorsByChamber = `
	SELECT d.doctor_id, d.name, d.specialization, COALESCE(dep.department_name, '') as department_name
	FROM doctors d
	JOIN chamber_doctors cd ON d.doctor_id = cd.doctor_id
	LEFT JOIN departments dep ON d.department_id = dep.department_id
	WHERE cd.chamber_no = $1
	ORDER BY d.name;`

func ReadDoctorsByChamber(chamberNo int) ([]Doctor, error) {
	rows, err := postgres.Db.Query(queryGetDoctorsByChamber, chamberNo)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var doctors []Doctor
	for rows.Next() {
		var d Doctor
		if err := rows.Scan(&d.DoctorId, &d.Name, &d.Specialization, &d.DepartmentName); err != nil {
			return nil, err
		}
		doctors = append(doctors, d)
	}
	return doctors, nil
}

const queryDoctorLogin = `
	SELECT doctor_id, name, specialization
	FROM doctors WHERE doctor_id = $1 AND password = $2;`

func DoctorLogin(doctorId int, password string) (*Doctor, error) {
	var d Doctor
	err := postgres.Db.QueryRow(queryDoctorLogin, doctorId, password).Scan(
		&d.DoctorId, &d.Name, &d.Specialization,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &d, nil
}

const queryGetChamberByDoctor = `
	SELECT chamber_no FROM chamber_doctors
	WHERE doctor_id = $1 LIMIT 1;`

func GetChamberByDoctor(doctorId int) (int, error) {
	var chamberNo int
	err := postgres.Db.QueryRow(queryGetChamberByDoctor, doctorId).Scan(&chamberNo)
	if err == sql.ErrNoRows {
		return 0, sql.ErrNoRows
	}
	return chamberNo, err
}