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

func AddAppointment(w http.ResponseWriter, r *http.Request){
	var app model.Appointment
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(&app); err != nil{
		httpResp.RespondWithError(w, http.StatusBadRequest, "invalid json body")
		return
	}

	defer r.Body.Close()
	saveErr := app.Create()
	if saveErr != nil{
		log.Println("DB error:", saveErr)
		httpResp.RespondWithError(w, http.StatusBadRequest, saveErr.Error())
		return
	}
	httpResp.RespondWithJSON(w, http.StatusCreated, map[string]string{
    "aptID": strconv.FormatInt(app.AptId, 10),
})
}

func getAptId(appId string)(int64, error){
	aptId, aptErr := strconv.ParseInt(appId, 10, 64)
	if aptErr != nil{
		return 0, aptErr
	}
	return aptId, nil
}

func UpdateAppointment(w http.ResponseWriter, r *http.Request){
	old_appId := mux.Vars(r)["aptId"]
	old_aptID, idErr := getAptId(old_appId)
	if idErr != nil{
		httpResp.RespondWithError(w, http.StatusBadRequest, idErr.Error())
		return
	}
	var app model.Appointment
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(&app); err != nil{
		httpResp.RespondWithError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	defer r.Body.Close()

	
	if updateErr := app.Update(old_aptID); updateErr != nil{
		switch updateErr{
		case sql.ErrNoRows:
			httpResp.RespondWithError(w, http.StatusNotFound, "appointment doesn't exist")
		default:
			httpResp.RespondWithError(w, http.StatusInternalServerError, updateErr.Error())
		}
	} else{
		httpResp.RespondWithJSON(w, http.StatusOK, app)
	}
}

func DeleteAppointment(w http.ResponseWriter, r *http.Request){
	aptId := mux.Vars(r)["aptId"]
	appId, idErr := getAptId(aptId)
	if idErr != nil{
		httpResp.RespondWithError(w, http.StatusBadGateway, idErr.Error())
		return
	}

	apt:=model.Appointment{AptId: appId}
	if err := apt.Delete(); err != nil{
		httpResp.RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	httpResp.RespondWithJSON(w, http.StatusOK, map[string]string{"status:": "appointment deleted"})
}

func GetAppointment(w http.ResponseWriter, r *http.Request){
	aptId := mux.Vars(r)["aptId"]
	appId, idErr := getAptId(aptId)
	if idErr != nil{
		httpResp.RespondWithError(w, http.StatusBadGateway, idErr.Error())
		return
	}
	app := model.Appointment{AptId: appId}
	getErr := app.Read()
	if getErr != nil{
		switch getErr{
		case sql.ErrNoRows:
			httpResp.RespondWithError(w, http.StatusNotFound, "appointment not found")
		default: 
			httpResp.RespondWithJSON(w, http.StatusInternalServerError, getErr.Error())
		}
		return
	}
	httpResp.RespondWithJSON(w, http.StatusOK, app)
}

func GetAllAppointments(w http.ResponseWriter, r *http.Request) {
    apps, err := model.ReadAll()
    if err != nil {
        httpResp.RespondWithError(w, http.StatusInternalServerError, err.Error())
        return
    }
    httpResp.RespondWithJSON(w, http.StatusOK, apps)
}

func GetAppointmentsByDate(w http.ResponseWriter, r *http.Request) {
	date := r.URL.Query().Get("date")
	if date == "" {
		httpResp.RespondWithError(w, http.StatusBadRequest, "date is required")
		return
	}

	apps, err := model.ReadByDate(date)
	if err != nil {
		log.Println("DB error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "could not fetch appointments")
		return
	}

	httpResp.RespondWithJSON(w, http.StatusOK, apps)
}
