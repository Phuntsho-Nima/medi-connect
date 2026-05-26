package model

import (
	"database/sql"
	"fmt"
	"hospitalOPD/dataStore/postgres"
)

type Admin struct {
	AdminId  int    `json:"adminId"`
	Name     string `json:"name"`
	Password string `json:"password,omitempty"`
	Email    string `json:"email"`
}

const queryInsertAdmin = `
	INSERT INTO admins (name, password)
	VALUES ($1, $2)
	RETURNING admin_id;`

func (a *Admin) Create() error {
	return postgres.Db.QueryRow(queryInsertAdmin, a.Name, a.Password).Scan(&a.AdminId)
}

const queryInsertAdminEmail = `
	INSERT INTO admin_email (email, admin_id) VALUES ($1, $2);`

func AddAdminEmail(adminId int, email string) error {
	_, err := postgres.Db.Exec(queryInsertAdminEmail, email, adminId)
	return err
}

const queryGetAdminById = `
	SELECT a.admin_id, a.name, COALESCE(e.email, '') as email
	FROM admins a
	LEFT JOIN admin_email e ON a.admin_id = e.admin_id
	WHERE a.admin_id = $1
	LIMIT 1;`

func (a *Admin) Read() error {
	return postgres.Db.QueryRow(queryGetAdminById, a.AdminId).Scan(
		&a.AdminId, &a.Name, &a.Email,
	)
}

const queryUpdateAdmin = `
	UPDATE admins SET name = $1 WHERE admin_id = $2 RETURNING admin_id;`

func (a *Admin) Update() error {
	return postgres.Db.QueryRow(queryUpdateAdmin, a.Name, a.AdminId).Scan(&a.AdminId)
}

const queryGetAllAdmins = `
	SELECT a.admin_id, a.name, COALESCE(e.email, '') as email
	FROM admins a
	LEFT JOIN admin_email e ON a.admin_id = e.admin_id
	ORDER BY a.admin_id;`

func ReadAllAdmins() ([]Admin, error) {
	rows, err := postgres.Db.Query(queryGetAllAdmins)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var admins []Admin
	for rows.Next() {
		var a Admin
		if err := rows.Scan(&a.AdminId, &a.Name, &a.Email); err != nil {
			return nil, err
		}
		admins = append(admins, a)
	}
	return admins, nil
}

const queryAdminLogin = `
	SELECT a.admin_id, a.name
	FROM admins a
	JOIN admin_email e ON a.admin_id = e.admin_id
	WHERE e.email = $1 AND a.password = $2;`

func AdminLogin(email string, password string) (*Admin, error) {
	var a Admin
	err := postgres.Db.QueryRow(queryAdminLogin, email, password).Scan(&a.AdminId, &a.Name)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	a.Email = email
	return &a, nil
}

// ── ACTIVITY FEED ────────────────────────────────────────────────────────────

// ActivityEvent is a single entry in the admin system activity feed.
type ActivityEvent struct {
	EventType string `json:"event_type"`
	Name      string `json:"name"`
	EventTime string `json:"event_time"`
}

const queryAdminActivity = `
	SELECT event_type, name, event_time::text FROM (
		SELECT 'user_registered'    AS event_type, name,
		       created_at           AS event_time
		FROM users
		UNION ALL
		SELECT 'doctor_added'       AS event_type, name,
		       created_at           AS event_time
		FROM doctors
		UNION ALL
		SELECT 'appointment_booked' AS event_type, u.name,
		       (a.appointment_date::timestamp + a.appointment_time) AS event_time
		FROM appointments a
		JOIN users u ON a.CID = u.CID
	) sub
	ORDER BY event_time DESC
	LIMIT 5;`

func ReadAdminActivity() ([]ActivityEvent, error) {
	rows, err := postgres.Db.Query(queryAdminActivity)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []ActivityEvent
	for rows.Next() {
		var e ActivityEvent
		if err := rows.Scan(&e.EventType, &e.Name, &e.EventTime); err != nil {
			return nil, err
		}
		events = append(events, e)
	}
	return events, nil
}

// ── SETTINGS ─────────────────────────────────────────────────────────────────

// GetAdminProfile returns the logged-in admin's name and email.
func GetAdminProfile(adminId int) (name, email string, err error) {
	a := Admin{AdminId: adminId}
	err = a.Read()
	return a.Name, a.Email, err
}

func UpdateAdminEmail(adminId int, newEmail string) error {
	tx, err := postgres.Db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.Exec("DELETE FROM admin_email WHERE admin_id = $1", adminId); err != nil {
		return err
	}
	if _, err = tx.Exec("INSERT INTO admin_email (email, admin_id) VALUES ($1, $2)", newEmail, adminId); err != nil {
		return err
	}
	return tx.Commit()
}

func UpdateAdminPassword(adminId int, currentPassword, newPassword string) error {
	var id int
	err := postgres.Db.QueryRow(
		"SELECT admin_id FROM admins WHERE admin_id = $1 AND password = $2",
		adminId, currentPassword,
	).Scan(&id)
	if err == sql.ErrNoRows {
		return fmt.Errorf("current password is incorrect")
	}
	if err != nil {
		return err
	}
	_, err = postgres.Db.Exec(
		"UPDATE admins SET password = $1 WHERE admin_id = $2",
		newPassword, adminId,
	)
	return err
}

func ensureConfigTable() {
	postgres.Db.Exec(`CREATE TABLE IF NOT EXISTS config (
		key   VARCHAR(100) PRIMARY KEY,
		value TEXT NOT NULL DEFAULT ''
	)`)
}

func GetConfigValue(key string) (string, error) {
	ensureConfigTable()
	var value string
	err := postgres.Db.QueryRow("SELECT value FROM config WHERE key = $1", key).Scan(&value)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return value, err
}

func SetConfigValue(key, value string) error {
	ensureConfigTable()
	_, err := postgres.Db.Exec(
		"INSERT INTO config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
		key, value,
	)
	return err
}