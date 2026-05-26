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

// GetPatientRecords handles GET /patient/records/{cid}
// Returns all records + prescriptions for a patient
func GetPatientRecords(w http.ResponseWriter, r *http.Request) {
	cid := mux.Vars(r)["cid"]
	if cid == "" {
		httpResp.RespondWithError(w, http.StatusBadRequest, "cid is required")
		return
	}

	records, err := model.ReadRecordsByCID(cid)
	if err != nil {
		log.Println("DB error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "could not fetch records")
		return
	}

	httpResp.RespondWithJSON(w, http.StatusOK, records)
}

// AddRecord handles POST /doctor/record
// Doctor creates a new record for a patient
func AddRecord(w http.ResponseWriter, r *http.Request) {
	var rec model.Record
	if err := json.NewDecoder(r.Body).Decode(&rec); err != nil {
		httpResp.RespondWithError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	defer r.Body.Close()

	if rec.CID == "" {
		httpResp.RespondWithError(w, http.StatusBadRequest, "cid is required")
		return
	}

	if err := rec.Create(); err != nil {
		log.Println("DB error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "could not create record")
		return
	}

	// Insert prescriptions if provided
	for _, p := range rec.Prescription {
		if p == "" {
			continue
		}
		if err := model.AddPrescription(rec.RecordId, p); err != nil {
			log.Println("Prescription insert error:", err)
		}
	}

	httpResp.RespondWithJSON(w, http.StatusCreated, map[string]interface{}{
		"record_id": rec.RecordId,
		"message":   "record created successfully",
	})
}

// GetRecord handles GET /record/{recordId}
// Returns a single record with prescriptions
func GetRecord(w http.ResponseWriter, r *http.Request) {
	recordId, err := strconv.Atoi(mux.Vars(r)["recordId"])
	if err != nil {
		httpResp.RespondWithError(w, http.StatusBadRequest, "invalid record id")
		return
	}

	rec := model.Record{RecordId: recordId}
	if err := rec.Read(); err != nil {
		switch err {
		case sql.ErrNoRows:
			httpResp.RespondWithError(w, http.StatusNotFound, "record not found")
		default:
			log.Println("DB error:", err)
			httpResp.RespondWithError(w, http.StatusInternalServerError, "could not fetch record")
		}
		return
	}

	httpResp.RespondWithJSON(w, http.StatusOK, rec)
}

// DeleteRecord handles DELETE /admin/record/{recordId}
// Admin deletes a record
func DeleteRecord(w http.ResponseWriter, r *http.Request) {
	recordId, err := strconv.Atoi(mux.Vars(r)["recordId"])
	if err != nil {
		httpResp.RespondWithError(w, http.StatusBadRequest, "invalid record id")
		return
	}

	rec := model.Record{RecordId: recordId}
	if err := rec.Delete(); err != nil {
		switch err {
		case sql.ErrNoRows:
			httpResp.RespondWithError(w, http.StatusNotFound, "record not found")
		default:
			log.Println("DB error:", err)
			httpResp.RespondWithError(w, http.StatusInternalServerError, "could not delete record")
		}
		return
	}

	httpResp.RespondWithJSON(w, http.StatusOK, map[string]string{"message": "record deleted"})
}