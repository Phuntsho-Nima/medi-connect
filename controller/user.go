package controller

import (
	"database/sql"
	"encoding/json"
	"hospitalOPD/model"
	"hospitalOPD/utils/httpResp"
	"log"
	"net/http"

	"github.com/gorilla/mux"
)

// RegisterUser handles POST /user/register
// Accepts JSON body with user details, checks CID not already taken, then inserts
func RegisterUser(w http.ResponseWriter, r *http.Request) {
	var u model.User
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		httpResp.RespondWithError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	defer r.Body.Close()

	// Validate required fields
	if u.Cid == "" || u.Name == "" || u.Password == ""{
		httpResp.RespondWithError(w, http.StatusBadRequest, "cid, name, password, dob and gender are required")
		return
	}

	if u.DOB == "" {
		u.DOB = "2000-01-01"
	}
	if u.Gender == "" {
		u.Gender = "Other"
	}

	// Check if CID already registered
	exists, err := model.CIDExists(u.Cid)
	if err != nil {
		log.Println("DB error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "could not check CID")
		return
	}
	if exists {
		httpResp.RespondWithError(w, http.StatusConflict, "CID already registered")
		return
	}

	// Create the user — password gets hashed inside u.Create()
	if err := u.Create(); err != nil {
		log.Println("DB error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "could not register user")
		return
	}

	httpResp.RespondWithJSON(w, http.StatusCreated, map[string]string{
		"cid":     u.Cid,
		"message": "registration successful",
	})
}

// LoginUser handles POST /user/login
// Accepts CID + password, returns session token on success
func LoginUser(w http.ResponseWriter, r *http.Request) {
	// Accept login credentials as JSON
	var creds struct {
		Cid      string `json:"cid"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		httpResp.RespondWithError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	defer r.Body.Close()

	if creds.Cid == "" || creds.Password == "" {
		httpResp.RespondWithError(w, http.StatusBadRequest, "cid and password are required")
		return
	}

	// Verify credentials — returns nil user if wrong
	user, err := model.UserLogin(creds.Cid, creds.Password)
	if err != nil {
		log.Println("DB error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "login failed")
		return
	}
	if user == nil {
		httpResp.RespondWithError(w, http.StatusUnauthorized, "invalid CID or password")
		return
	}

	// Create a session token and set cookiez
	token, err := model.CreateSession(user.Cid, 0, 0, "user")
	if err != nil {
		log.Println("Session error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "could not create session")
		return
	}

	// Set the session cookie — expires in 24 hours
	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    token,
		Path:     "/",
		HttpOnly: true, // not accessible via JavaScript — more secure
	})

	httpResp.RespondWithJSON(w, http.StatusOK, map[string]string{
		"message": "login successful",
		"cid":     user.Cid,
		"name":    user.Name,
	})
}

// LogoutUser handles POST /user/logout
// Deletes the session from DB and clears the cookie
func LogoutUser(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("session_token")
	if err != nil {
		httpResp.RespondWithError(w, http.StatusUnauthorized, "not logged in")
		return
	}

	// Delete session from DB
	if err := model.DeleteSession(cookie.Value); err != nil {
		log.Println("Session delete error:", err)
	}

	// Clear the cookie by setting MaxAge to -1
	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
	})

	httpResp.RespondWithJSON(w, http.StatusOK, map[string]string{"message": "logged out"})
}

// GetUser handles GET /user/{cid}
// Returns a user's profile details
func GetUser(w http.ResponseWriter, r *http.Request) {
	cid := mux.Vars(r)["cid"]
	if cid == "" {
		httpResp.RespondWithError(w, http.StatusBadRequest, "cid is required")
		return
	}

	u := model.User{Cid: cid}
	if err := u.Read(); err != nil {
		switch err {
		case sql.ErrNoRows:
			httpResp.RespondWithError(w, http.StatusNotFound, "user not found")
		default:
			log.Println("DB error:", err)
			httpResp.RespondWithError(w, http.StatusInternalServerError, "could not fetch user")
		}
		return
	}

	httpResp.RespondWithJSON(w, http.StatusOK, u)
}

// UpdateUser handles PUT /user/{cid}
// Updates a user's profile details
func UpdateUser(w http.ResponseWriter, r *http.Request) {
	cid := mux.Vars(r)["cid"]

	var u model.User
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		httpResp.RespondWithError(w, http.StatusBadRequest, "invalid json body")
		return
	}
	defer r.Body.Close()

	u.Cid = cid
	if err := u.Update(); err != nil {
		switch err {
		case sql.ErrNoRows:
			httpResp.RespondWithError(w, http.StatusNotFound, "user not found")
		default:
			log.Println("DB error:", err)
			httpResp.RespondWithError(w, http.StatusInternalServerError, "could not update user")
		}
		return
	}

	httpResp.RespondWithJSON(w, http.StatusOK, map[string]string{"message": "profile updated"})
}

// DeleteUser handles DELETE /user/{cid}
// Removes a user from the system (admin use)
func DeleteUser(w http.ResponseWriter, r *http.Request) {
	cid := mux.Vars(r)["cid"]

	u := model.User{Cid: cid}
	if err := u.Delete(); err != nil {
		switch err {
		case sql.ErrNoRows:
			httpResp.RespondWithError(w, http.StatusNotFound, "user not found")
		default:
			log.Println("DB error:", err)
			httpResp.RespondWithError(w, http.StatusInternalServerError, "could not delete user")
		}
		return
	}

	httpResp.RespondWithJSON(w, http.StatusOK, map[string]string{"message": "user deleted"})
}

// GetAllUsers handles GET /users
// Returns all registered patients (admin use)
func GetAllUsers(w http.ResponseWriter, r *http.Request) {
	users, err := model.ReadAllUsers()
	if err != nil {
		log.Println("DB error:", err)
		httpResp.RespondWithError(w, http.StatusInternalServerError, "could not fetch users")
		return
	}
	httpResp.RespondWithJSON(w, http.StatusOK, users)
}