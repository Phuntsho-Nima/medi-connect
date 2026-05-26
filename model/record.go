package model

import (
	"hospitalOPD/dataStore/postgres"
)

// Record represents a row in the records table
type Record struct {
	RecordId     int      `json:"record_id"`
	RecordDate   string   `json:"record_date"`
	Diagnosis    string   `json:"diagnosis"`
	Treatment    string   `json:"treatment"`
	DoctorNotes  string   `json:"doctor_notes"`
	CID          string   `json:"cid"`
	AdminId      int      `json:"admin_id,omitempty"`
	Prescription []string `json:"prescriptions"` // from record_prescription table
}

// Create inserts a new record and returns the generated record_id
const queryInsertRecord = `
	INSERT INTO records (diagnosis, treatment, doctor_notes, CID, admin_id)
	VALUES ($1, $2, $3, $4, $5)
	RETURNING record_id, record_date;`

func (rec *Record) Create() error {
	var adminId interface{}
	if rec.AdminId != 0 {
		adminId = rec.AdminId
	}
	return postgres.Db.QueryRow(
		queryInsertRecord,
		rec.Diagnosis, rec.Treatment, rec.DoctorNotes, rec.CID, adminId,
	).Scan(&rec.RecordId, &rec.RecordDate)
}

// AddPrescription inserts a prescription line for a record
const queryInsertPrescription = `
	INSERT INTO record_prescription (prescription, record_id)
	VALUES ($1, $2)
	ON CONFLICT DO NOTHING;`

func AddPrescription(recordId int, prescription string) error {
	_, err := postgres.Db.Exec(queryInsertPrescription, prescription, recordId)
	return err
}

// GetPrescriptions fetches all prescriptions for a record
const queryGetPrescriptions = `
	SELECT prescription FROM record_prescription
	WHERE record_id = $1;`

func GetPrescriptions(recordId int) ([]string, error) {
	rows, err := postgres.Db.Query(queryGetPrescriptions, recordId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var prescriptions []string
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err != nil {
			return nil, err
		}
		prescriptions = append(prescriptions, p)
	}
	return prescriptions, nil
}

// ReadAllByCID fetches all records for a patient, with prescriptions
const queryGetRecordsByCID = `
	SELECT record_id, record_date, COALESCE(diagnosis, ''), COALESCE(treatment, ''), COALESCE(doctor_notes, ''), CID
	FROM records
	WHERE CID = $1
	ORDER BY record_date DESC;`

func ReadRecordsByCID(cid string) ([]Record, error) {
	rows, err := postgres.Db.Query(queryGetRecordsByCID, cid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []Record
	for rows.Next() {
		var rec Record
		if err := rows.Scan(
			&rec.RecordId, &rec.RecordDate, &rec.Diagnosis,
			&rec.Treatment, &rec.DoctorNotes, &rec.CID,
		); err != nil {
			return nil, err
		}

		// Fetch prescriptions for each record
		rec.Prescription, _ = GetPrescriptions(rec.RecordId)
		if rec.Prescription == nil {
			rec.Prescription = []string{}
		}

		records = append(records, rec)
	}
	return records, nil
}

// Read fetches a single record by ID
const queryGetRecordById = `
	SELECT record_id, record_date, COALESCE(diagnosis, ''), COALESCE(treatment, ''), COALESCE(doctor_notes, ''), CID
	FROM records
	WHERE record_id = $1;`

func (rec *Record) Read() error {
	err := postgres.Db.QueryRow(queryGetRecordById, rec.RecordId).Scan(
		&rec.RecordId, &rec.RecordDate, &rec.Diagnosis,
		&rec.Treatment, &rec.DoctorNotes, &rec.CID,
	)
	if err != nil {
		return err
	}
	rec.Prescription, _ = GetPrescriptions(rec.RecordId)
	if rec.Prescription == nil {
		rec.Prescription = []string{}
	}
	return nil
}

// Delete removes a record by ID
const queryDeleteRecord = `
	DELETE FROM records WHERE record_id = $1 RETURNING record_id;`

func (rec *Record) Delete() error {
	return postgres.Db.QueryRow(queryDeleteRecord, rec.RecordId).Scan(&rec.RecordId)
}