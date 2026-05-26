package controller

import (
	"database/sql"
	"encoding/json"
	"hospitalOPD/model"
	"hospitalOPD/utils/httpResp"
	"log"
	"net/http"
	"strconv"
	"hospitalOPD/middleware"
	"github.com/gorilla/mux"
)

// LoginDoctor handles POST /doctor/login
// Accepts doctor_id + password, returns session token on success
func LoginDoctor(w http.ResponseWriter, r *http.Request) {
	var creds struct {
		DoctorId int    `json:"doctorId"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		httpResp.RespondWithError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	defer r.Body.Close()

	if creds.DoctorId == 0 || creds.Password == "" {
		httpResp.RespondWithError(w, http.StatusBadRequest, "doctorId and password are required")
		return
	}

	// Verify credentials — returns nil if wrong
	doctor, err := model.DoctorLogin(creds.DoctorId, creds.Password)
	if err != nil {
		log.Println("DB error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "login failed")
		return
	}
	if doctor == nil {
		httpResp.RespondWithError(w, http.StatusUnauthorized, "invalid doctor ID or password")
		return
	}

	// Create session for doctor role
	token, err := model.CreateSession("", 0, doctor.DoctorId, "doctor")
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
		"message":  "login successful",
		"doctorId": doctor.DoctorId,
		"name":     doctor.Name,
	})
}

// LogoutDoctor handles POST /doctor/logout
// Deletes session from DB and clears the cookie
func LogoutDoctor(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("session_token")
	if err != nil {
		httpResp.RespondWithError(w, http.StatusUnauthorized, "not logged in")
		return
	}

	if err := model.DeleteSession(cookie.Value); err != nil {
		log.Println("Session delete error:", err)
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
	})

	httpResp.RespondWithJSON(w, http.StatusOK, map[string]string{"message": "logged out"})
}

// GetAllDoctors handles GET /admin/doctors
// Returns all doctors with their department names
func GetAllDoctors(w http.ResponseWriter, r *http.Request) {
	doctors, err := model.ReadAllDoctors()
	if err != nil {
		log.Println("DB error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "could not fetch doctors")
		return
	}
	httpResp.RespondWithJSON(w, http.StatusOK, doctors)
}

// GetDoctor handles GET /admin/doctor/{doctorId}
// Returns a single doctor's details
func GetDoctor(w http.ResponseWriter, r *http.Request) {
	doctorId, err := strconv.Atoi(mux.Vars(r)["doctorId"])
	if err != nil {
		httpResp.RespondWithError(w, http.StatusBadRequest, "invalid doctor id")
		return
	}

	d := model.Doctor{DoctorId: doctorId}
	if err := d.Read(); err != nil {
		switch err {
		case sql.ErrNoRows:
			httpResp.RespondWithError(w, http.StatusNotFound, "doctor not found")
		default:
			log.Println("DB error:", err)
			httpResp.RespondWithError(w, http.StatusInternalServerError, "could not fetch doctor")
		}
		return
	}

	httpResp.RespondWithJSON(w, http.StatusOK, d)
}

// AddDoctor handles POST /admin/doctor
// Creates a new doctor — admin only
func AddDoctor(w http.ResponseWriter, r *http.Request) {
	var d model.Doctor
	if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
		httpResp.RespondWithError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	defer r.Body.Close()

	if d.Name == "" || d.Password == "" {
		httpResp.RespondWithError(w, http.StatusBadRequest, "name and password are required")
		return
	}

	if err := d.Create(); err != nil {
		log.Println("DB error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "could not add doctor")
		return
	}

	httpResp.RespondWithJSON(w, http.StatusCreated, map[string]interface{}{
		"doctorId": d.DoctorId,
		"message":  "doctor added successfully",
	})
}

// UpdateDoctor handles PUT /admin/doctor/{doctorId}
// Updates a doctor's name, specialization, or department
func UpdateDoctor(w http.ResponseWriter, r *http.Request) {
	doctorId, err := strconv.Atoi(mux.Vars(r)["doctorId"])
	if err != nil {
		httpResp.RespondWithError(w, http.StatusBadRequest, "invalid doctor id")
		return
	}

	var d model.Doctor
	if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
		httpResp.RespondWithError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	defer r.Body.Close()

	d.DoctorId = doctorId
	if err := d.Update(); err != nil {
		switch err {
		case sql.ErrNoRows:
			httpResp.RespondWithError(w, http.StatusNotFound, "doctor not found")
		default:
			log.Println("DB error:", err)
			httpResp.RespondWithError(w, http.StatusInternalServerError, "could not update doctor")
		}
		return
	}

	httpResp.RespondWithJSON(w, http.StatusOK, map[string]string{"message": "doctor updated"})
}

// DeleteDoctor handles DELETE /admin/doctor/{doctorId}
// Removes a doctor from the system
func DeleteDoctor(w http.ResponseWriter, r *http.Request) {
	doctorId, err := strconv.Atoi(mux.Vars(r)["doctorId"])
	if err != nil {
		httpResp.RespondWithError(w, http.StatusBadRequest, "invalid doctor id")
		return
	}

	d := model.Doctor{DoctorId: doctorId}
	if err := d.Delete(); err != nil {
		switch err {
		case sql.ErrNoRows:
			httpResp.RespondWithError(w, http.StatusNotFound, "doctor not found")
		default:
			log.Println("DB error:", err)
			httpResp.RespondWithError(w, http.StatusInternalServerError, "could not delete doctor")
		}
		return
	}

	httpResp.RespondWithJSON(w, http.StatusOK, map[string]string{"message": "doctor deleted"})
}

// GetDoctorDashboard handles GET /doctor/dashboard
// Returns the logged-in doctor's info + assigned chamber
func GetDoctorDashboard(w http.ResponseWriter, r *http.Request) {
	session := middleware.GetSessionFromContext(r)
	if session == nil {
		httpResp.RespondWithError(w, http.StatusUnauthorized, "not authorized")
		return
	}

	d := model.Doctor{DoctorId: session.DoctorRef}
	if err := d.Read(); err != nil {
		switch err {
		case sql.ErrNoRows:
			httpResp.RespondWithError(w, http.StatusNotFound, "doctor not found")
		default:
			log.Println("DB error:", err)
			httpResp.RespondWithError(w, http.StatusInternalServerError, "could not fetch doctor info")
		}
		return
	}

	// Get assigned chamber from chamber_doctors table
	chamberNo, err := model.GetChamberByDoctor(session.DoctorRef)
	if err != nil && err != sql.ErrNoRows {
		log.Println("DB error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "could not fetch chamber info")
		return
	}

	httpResp.RespondWithJSON(w, http.StatusOK, map[string]interface{}{
		"doctor_id":  d.DoctorId,
		"name":       d.Name,
		"chamber_no": chamberNo, // 0 if not assigned to any chamber
	})
}