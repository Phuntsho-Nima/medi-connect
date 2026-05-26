package controller

import (
	"database/sql"
	"encoding/json"
	"hospitalOPD/model"
	"hospitalOPD/utils/httpResp"
	"log"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
)

func GetAllChambers(w http.ResponseWriter, r *http.Request) {
	chambers, err := model.ReadAllChambers()
	if err != nil {
		log.Println("DB error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "could not fetch chambers")
		return
	}
	httpResp.RespondWithJSON(w, http.StatusOK, chambers)
}

func GetAvailableChambers(w http.ResponseWriter, r *http.Request) {
	chambers, err := model.ReadAvailableChambers()
	if err != nil {
		log.Println("DB error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "could not fetch chambers")
		return
	}
	httpResp.RespondWithJSON(w, http.StatusOK, chambers)
}

func AddChamber(w http.ResponseWriter, r *http.Request) {
	var c model.Chamber
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		httpResp.RespondWithError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	defer r.Body.Close()

	if c.ChamberName == "" {
		httpResp.RespondWithError(w, http.StatusBadRequest, "chamber name is required")
		return
	}

	if err := c.Create(); err != nil {
		log.Println("DB error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "could not add chamber")
		return
	}

	httpResp.RespondWithJSON(w, http.StatusCreated, map[string]interface{}{
		"chamberNo": c.ChamberNo,
		"message":   "chamber added successfully",
	})
}

func UpdateChamber(w http.ResponseWriter, r *http.Request) {
	chamberNo, err := strconv.Atoi(mux.Vars(r)["chamberId"])
	if err != nil {
		httpResp.RespondWithError(w, http.StatusBadRequest, "invalid chamber id")
		return
	}

	var c model.Chamber
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		httpResp.RespondWithError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	defer r.Body.Close()

	c.ChamberNo = chamberNo
	if err := c.Update(); err != nil {
		switch err {
		case sql.ErrNoRows:
			httpResp.RespondWithError(w, http.StatusNotFound, "chamber not found")
		default:
			log.Println("DB error:", err)
			httpResp.RespondWithError(w, http.StatusInternalServerError, "could not update chamber")
		}
		return
	}

	httpResp.RespondWithJSON(w, http.StatusOK, map[string]string{"message": "chamber updated"})
}

func DeleteChamber(w http.ResponseWriter, r *http.Request) {
	chamberNo, err := strconv.Atoi(mux.Vars(r)["chamberId"])
	if err != nil {
		httpResp.RespondWithError(w, http.StatusBadRequest, "invalid chamber id")
		return
	}

	c := model.Chamber{ChamberNo: chamberNo}
	if err := c.Delete(); err != nil {
		switch err {
		case sql.ErrNoRows:
			httpResp.RespondWithError(w, http.StatusNotFound, "chamber not found")
		default:
			log.Println("DB error:", err)
			httpResp.RespondWithError(w, http.StatusInternalServerError, "could not delete chamber")
		}
		return
	}

	httpResp.RespondWithJSON(w, http.StatusOK, map[string]string{"message": "chamber deleted"})
}

func AssignDoctor(w http.ResponseWriter, r *http.Request) {
	chamberNo, err := strconv.Atoi(mux.Vars(r)["chamberId"])
	if err != nil {
		httpResp.RespondWithError(w, http.StatusBadRequest, "invalid chamber id")
		return
	}

	var body struct {
		DoctorId int `json:"doctorId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpResp.RespondWithError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	defer r.Body.Close()

	if body.DoctorId == 0 {
		httpResp.RespondWithError(w, http.StatusBadRequest, "doctorId is required")
		return
	}

	if err := model.AssignDoctorToChamber(chamberNo, body.DoctorId); err != nil {
		log.Println("DB error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "could not assign doctor")
		return
	}

	httpResp.RespondWithJSON(w, http.StatusOK, map[string]string{"message": "doctor assigned to chamber"})
}

func RemoveDoctor(w http.ResponseWriter, r *http.Request) {
	chamberNo, err := strconv.Atoi(mux.Vars(r)["chamberId"])
	if err != nil {
		httpResp.RespondWithError(w, http.StatusBadRequest, "invalid chamber id")
		return
	}

	var body struct {
		DoctorId int `json:"doctorId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpResp.RespondWithError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	defer r.Body.Close()

	if body.DoctorId == 0 {
		httpResp.RespondWithError(w, http.StatusBadRequest, "doctorId is required")
		return
	}

	if err := model.RemoveDoctorFromChamber(chamberNo, body.DoctorId); err != nil {
		log.Println("DB error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "could not remove doctor")
		return
	}

	httpResp.RespondWithJSON(w, http.StatusOK, map[string]string{"message": "doctor removed from chamber"})
}

func GetChamberAppointments(w http.ResponseWriter, r *http.Request) {
	chamberNo, err := strconv.Atoi(mux.Vars(r)["chamberId"])
	if err != nil {
		httpResp.RespondWithError(w, http.StatusBadRequest, "invalid chamber id")
		return
	}

	date := r.URL.Query().Get("date")

	if date != "" {
		appointments, err := model.ReadChamberAppointmentsByDate(chamberNo, date)
		if err != nil {
			log.Println("DB error:", err)
			httpResp.RespondWithError(w, http.StatusInternalServerError, "could not fetch appointments")
			return
		}
		httpResp.RespondWithJSON(w, http.StatusOK, appointments)
		return
	}

	appointments, err := model.ReadAppointmentsByChamber(chamberNo)
	if err != nil {
		log.Println("DB error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "could not fetch appointments")
		return
	}
	httpResp.RespondWithJSON(w, http.StatusOK, appointments)
}

func GetPatientAppointments(w http.ResponseWriter, r *http.Request) {
	cid := mux.Vars(r)["cid"]
	if cid == "" {
		httpResp.RespondWithError(w, http.StatusBadRequest, "cid is required")
		return
	}

	appointments, err := model.ReadAppointmentsByPatient(cid)
	if err != nil {
		log.Println("DB error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "could not fetch appointments")
		return
	}
	httpResp.RespondWithJSON(w, http.StatusOK, appointments)
}

func UpdateAppointmentStatus(w http.ResponseWriter, r *http.Request) {
	aptId, err := strconv.ParseInt(mux.Vars(r)["aptId"], 10, 64)
	if err != nil {
		httpResp.RespondWithError(w, http.StatusBadRequest, "invalid appointment id")
		return
	}

	var body struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpResp.RespondWithError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	defer r.Body.Close()

	if body.Status != "Pending" && body.Status != "Completed" && body.Status != "Cancelled" {
		httpResp.RespondWithError(w, http.StatusBadRequest, "status must be Pending, Completed or Cancelled")
		return
	}

	if err := model.UpdateAppointmentStatus(aptId, body.Status); err != nil {
		switch err {
		case sql.ErrNoRows:
			httpResp.RespondWithError(w, http.StatusNotFound, "appointment not found")
		default:
			log.Println("DB error:", err)
			httpResp.RespondWithError(w, http.StatusInternalServerError, "could not update status")
		}
		return
	}

	httpResp.RespondWithJSON(w, http.StatusOK, map[string]string{"message": "status updated"})
}

func GetBookedSlots(w http.ResponseWriter, r *http.Request) {
	chamberNo, err := strconv.ParseInt(r.URL.Query().Get("chamber_no"), 10, 64)
	if err != nil {
		httpResp.RespondWithError(w, http.StatusBadRequest, "invalid chamber_no")
		return
	}

	date := r.URL.Query().Get("date")
	if date == "" {
		httpResp.RespondWithError(w, http.StatusBadRequest, "date is required")
		return
	}

	slots, err := model.ReadBookedSlots(chamberNo, date)
	if err != nil {
		log.Println("DB error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "could not fetch slots")
		return
	}

	if slots == nil {
		slots = []string{}
	}

	httpResp.RespondWithJSON(w, http.StatusOK, slots)
}