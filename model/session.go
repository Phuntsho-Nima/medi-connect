package model

import (
	"crypto/sha256"
	"fmt"
	"hospitalOPD/dataStore/postgres"
	"time"
)

// Session represents a row in the sessions table
type Session struct {
	Token     string
	Role      string // "user", "admin", "doctor"
	UserRef   string // CID — filled for role "user"
	AdminRef  int    // admin_id — filled for role "admin"
	DoctorRef int    // doctor_id — filled for role "doctor"
	ExpiresAt time.Time
}

// CreateSession generates a token, inserts it into the sessions table, returns the token
// Pass the relevant ref for the role, leave others as zero/empty
func CreateSession(userRef string, adminRef int, doctorRef int, role string) (string, error) {
	// Generate token from role + ref + current time — unique every time
	raw := fmt.Sprintf("%s%s%s%d%d", role, userRef, time.Now().String(), adminRef, doctorRef)
	token := fmt.Sprintf("%x", sha256.Sum256([]byte(raw)))

	expiresAt := time.Now().Add(24 * time.Hour)

	const query = `
		INSERT INTO sessions (token, role, user_ref, admin_ref, doctor_ref, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6);`

	// Use nil for zero values so DB stores NULL instead of 0
	var uRef interface{} = nil
	var aRef interface{} = nil
	var dRef interface{} = nil

	switch role {
	case "user":
		uRef = userRef
	case "admin":
		aRef = adminRef
	case "doctor":
		dRef = doctorRef
	}

	_, err := postgres.Db.Exec(query, token, role, uRef, aRef, dRef, expiresAt)
	if err != nil {
		return "", err
	}
	return token, nil
}

// GetSession fetches a session by token and checks it hasn't expired
// Returns nil session if not found or expired
func GetSession(token string) (*Session, error) {
	const query = `
		SELECT token, role, user_ref, admin_ref, doctor_ref, expires_at
		FROM sessions
		WHERE token = $1 AND expires_at > NOW();`

	var s Session
	var userRef *string
	var adminRef *int
	var doctorRef *int

	err := postgres.Db.QueryRow(query, token).Scan(
		&s.Token, &s.Role, &userRef, &adminRef, &doctorRef, &s.ExpiresAt,
	)
	if err != nil {
		return nil, err
	}

	// Safely dereference nullable fields
	if userRef != nil {
		s.UserRef = *userRef
	}
	if adminRef != nil {
		s.AdminRef = *adminRef
	}
	if doctorRef != nil {
		s.DoctorRef = *doctorRef
	}

	return &s, nil
}

// DeleteSession removes a session token from the DB (logout)
func DeleteSession(token string) error {
	_, err := postgres.Db.Exec("DELETE FROM sessions WHERE token = $1", token)
	return err
}

// CleanExpiredSessions removes all expired sessions from the DB
// Call this occasionally to keep the sessions table clean
func CleanExpiredSessions() error {
	_, err := postgres.Db.Exec("DELETE FROM sessions WHERE expires_at <= NOW()")
	return err
}