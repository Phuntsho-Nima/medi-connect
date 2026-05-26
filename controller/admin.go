package controller

import (
	"encoding/json"
	"hospitalOPD/model"
	"hospitalOPD/utils/httpResp"
	"log"
	"net/http"
)

// LoginAdmin handles POST /admin/login
// Accepts email + password, returns session token on success
func LoginAdmin(w http.ResponseWriter, r *http.Request) {
	var creds struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		httpResp.RespondWithError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	defer r.Body.Close()

	if creds.Email == "" || creds.Password == "" {
		httpResp.RespondWithError(w, http.StatusBadRequest, "email and password are required")
		return
	}

	// Verify credentials — returns nil if wrong
	admin, err := model.AdminLogin(creds.Email, creds.Password)
	if err != nil {
		log.Println("DB error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "login failed")
		return
	}
	if admin == nil {
		httpResp.RespondWithError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	// Create session for admin role
	token, err := model.CreateSession("", admin.AdminId, 0, "admin")
	if err != nil {
		log.Println("Session error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "could not create session")
		return
	}

	// Set session cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
	})

	httpResp.RespondWithJSON(w, http.StatusOK, map[string]interface{}{
		"message": "login successful",
		"adminId": admin.AdminId,
		"name":    admin.Name,
	})
}

// LogoutAdmin handles POST /admin/logout
// Deletes session from DB and clears the cookie
func LogoutAdmin(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("session_token")
	if err != nil {
		httpResp.RespondWithError(w, http.StatusUnauthorized, "not logged in")
		return
	}

	if err := model.DeleteSession(cookie.Value); err != nil {
		log.Println("Session delete error:", err)
	}

	// Clear cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
	})

	httpResp.RespondWithJSON(w, http.StatusOK, map[string]string{"message": "logged out"})
}

// GetAdminDashboard handles GET /admin/dashboard
// Returns summary counts for the admin dashboard
func GetAdminDashboard(w http.ResponseWriter, r *http.Request) {
	// Total patients
	var totalPatients int
	err := model.CountUsers(&totalPatients)
	if err != nil {
		log.Println("DB error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "could not fetch dashboard data")
		return
	}

	// Total doctors
	var totalDoctors int
	err = model.CountDoctors(&totalDoctors)
	if err != nil {
		log.Println("DB error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "could not fetch dashboard data")
		return
	}

	// Total chambers
	var totalChambers int
	err = model.CountChambers(&totalChambers)
	if err != nil {
		log.Println("DB error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "could not fetch dashboard data")
		return
	}

	// Today's appointments
	var todayAppointments int
	err = model.CountTodayAppointments(&todayAppointments)
	if err != nil {
		log.Println("DB error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "could not fetch dashboard data")
		return
	}

	httpResp.RespondWithJSON(w, http.StatusOK, map[string]int{
		"totalPatients":      totalPatients,
		"totalDoctors":       totalDoctors,
		"totalChambers":      totalChambers,
		"todayAppointments":  todayAppointments,
	})
}