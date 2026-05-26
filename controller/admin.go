package controller

import (
	"encoding/json"
	"hospitalOPD/middleware"
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
	var totalPatients, totalDoctors, totalChambers, totalAppointments int

	if err := model.CountUsers(&totalPatients); err != nil {
		log.Println("DB error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "could not fetch dashboard data")
		return
	}
	if err := model.CountDoctors(&totalDoctors); err != nil {
		log.Println("DB error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "could not fetch dashboard data")
		return
	}
	if err := model.CountChambers(&totalChambers); err != nil {
		log.Println("DB error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "could not fetch dashboard data")
		return
	}
	if err := model.CountAllAppointments(&totalAppointments); err != nil {
		log.Println("DB error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "could not fetch dashboard data")
		return
	}

	httpResp.RespondWithJSON(w, http.StatusOK, map[string]int{
		"total_users":         totalPatients,
		"total_doctors":       totalDoctors,
		"total_chambers":      totalChambers,
		"total_appointments":  totalAppointments,
	})
}

// GetAdminActivity handles GET /admin/activity
func GetAdminActivity(w http.ResponseWriter, r *http.Request) {
	events, err := model.ReadAdminActivity()
	if err != nil {
		log.Println("DB error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "could not fetch activity")
		return
	}
	if events == nil {
		events = []model.ActivityEvent{}
	}
	httpResp.RespondWithJSON(w, http.StatusOK, events)
}

// GetAdminProfileHandler handles GET /admin/settings/profile
// Returns the logged-in admin's name and email for pre-filling the settings form.
func GetAdminProfileHandler(w http.ResponseWriter, r *http.Request) {
	session := middleware.GetSessionFromContext(r)
	name, email, err := model.GetAdminProfile(session.AdminRef)
	if err != nil {
		log.Println("DB error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "could not fetch profile")
		return
	}
	httpResp.RespondWithJSON(w, http.StatusOK, map[string]string{"name": name, "email": email})
}

// GetHospitalConfigHandler handles GET /admin/settings/hospital-name
func GetHospitalConfigHandler(w http.ResponseWriter, r *http.Request) {
	value, err := model.GetConfigValue("hospital_name")
	if err != nil {
		log.Println("DB error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "could not fetch config")
		return
	}
	httpResp.RespondWithJSON(w, http.StatusOK, map[string]string{"hospital_name": value})
}

// SetHospitalConfigHandler handles POST /admin/settings/hospital-name
func SetHospitalConfigHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		HospitalName string `json:"hospital_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpResp.RespondWithError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	defer r.Body.Close()
	if body.HospitalName == "" {
		httpResp.RespondWithError(w, http.StatusBadRequest, "hospital_name is required")
		return
	}
	if err := model.SetConfigValue("hospital_name", body.HospitalName); err != nil {
		log.Println("DB error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "could not update config")
		return
	}
	httpResp.RespondWithJSON(w, http.StatusOK, map[string]string{"message": "hospital name updated"})
}

// UpdateAdminEmailHandler handles POST /admin/settings/email
func UpdateAdminEmailHandler(w http.ResponseWriter, r *http.Request) {
	session := middleware.GetSessionFromContext(r)
	var body struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpResp.RespondWithError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	defer r.Body.Close()
	if body.Email == "" {
		httpResp.RespondWithError(w, http.StatusBadRequest, "email is required")
		return
	}
	if err := model.UpdateAdminEmail(session.AdminRef, body.Email); err != nil {
		log.Println("DB error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "could not update email")
		return
	}
	httpResp.RespondWithJSON(w, http.StatusOK, map[string]string{"message": "email updated"})
}

// UpdateAdminPasswordHandler handles POST /admin/settings/password
func UpdateAdminPasswordHandler(w http.ResponseWriter, r *http.Request) {
	session := middleware.GetSessionFromContext(r)
	var body struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpResp.RespondWithError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	defer r.Body.Close()
	if body.CurrentPassword == "" || body.NewPassword == "" {
		httpResp.RespondWithError(w, http.StatusBadRequest, "current and new password are required")
		return
	}
	if err := model.UpdateAdminPassword(session.AdminRef, body.CurrentPassword, body.NewPassword); err != nil {
		log.Println("Password update error:", err)
		httpResp.RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	httpResp.RespondWithJSON(w, http.StatusOK, map[string]string{"message": "password updated"})
}