package controller

import (
	"database/sql"
	"encoding/json"
	"hospitalOPD/middleware"
	"hospitalOPD/model"
	"hospitalOPD/utils/httpResp"
	"log"
	"net/http"
	"strconv"
	"time"

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
// Creates a new doctor — admin only.
// Accepts an optional doctor_id for manual assignment and an optional chamber_no
// to immediately assign the doctor to a chamber.
func AddDoctor(w http.ResponseWriter, r *http.Request) {
	var body struct {
		DoctorId       int    `json:"doctor_id"`
		Name           string `json:"name"`
		Specialization string `json:"specialization"`
		ChamberNo      int    `json:"chamber_no"`
		Password       string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpResp.RespondWithError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	defer r.Body.Close()

	if body.Name == "" || body.Password == "" {
		httpResp.RespondWithError(w, http.StatusBadRequest, "name and password are required")
		return
	}

	d := model.Doctor{
		DoctorId:       body.DoctorId,
		Name:           body.Name,
		Specialization: body.Specialization,
		Password:       body.Password,
	}

	// If a chamber is selected, read its department_id and assign it to the doctor
	if body.ChamberNo > 0 {
		ch := model.Chamber{ChamberNo: body.ChamberNo}
		if err := ch.Read(); err == nil {
			d.DepartmentId = ch.DepartmentId
		}
	}

	var insertErr error
	if body.DoctorId > 0 {
		insertErr = d.CreateWithManualId()
	} else {
		insertErr = d.Create()
	}
	if insertErr != nil {
		log.Println("DB error:", insertErr)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "could not add doctor")
		return
	}

	if body.ChamberNo > 0 {
		if err := model.AssignDoctorToChamber(body.ChamberNo, d.DoctorId); err != nil {
			log.Println("Chamber assignment error:", err)
		}
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

	// Fetch today's appointments to compute dashboard counts and subtitle
	patientsToday := 0
	waitingCount := 0
	nextPatientName := ""
	nextPatientTime := ""
	today := time.Now().Format("2006-01-02")
	if chamberNo > 0 {
		apts, aptErr := model.ReadChamberAppointmentsByDate(chamberNo, today)
		if aptErr == nil {
			patientsToday = len(apts)
			for _, a := range apts {
				if a.Status != "Completed" && a.Status != "Cancelled" {
					waitingCount++
					if nextPatientName == "" {
						nextPatientName = a.Name
						nextPatientTime = a.AptTime
					}
				}
			}
		}
	}

	httpResp.RespondWithJSON(w, http.StatusOK, map[string]interface{}{
		"doctor_id":         d.DoctorId,
		"name":              d.Name,
		"chamber_no":        chamberNo,
		"patients_today":    patientsToday,
		"waiting_count":     waitingCount,
		"next_patient_name": nextPatientName,
		"next_patient_time": nextPatientTime,
	})
}