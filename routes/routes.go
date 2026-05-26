package routes

import (
	"hospitalOPD/controller"
	"hospitalOPD/middleware"
	"log"
	"net/http"

	"github.com/gorilla/mux"
)

func InitializeRoutes() {
	router := mux.NewRouter()

	// PUBLIC ROUTES — no login required
	router.HandleFunc("/user/register", controller.RegisterUser).Methods("POST")
	router.HandleFunc("/user/login", controller.LoginUser).Methods("POST")
	router.HandleFunc("/admin/login", controller.LoginAdmin).Methods("POST")
	router.HandleFunc("/doctor/login", controller.LoginDoctor).Methods("POST")

	// USER (PATIENT) ROUTES — must be logged in as "user"
	router.HandleFunc("/user/{cid}/password", middleware.RequireRole("user", controller.ChangePassword)).Methods("PUT")
	router.HandleFunc("/user/{cid}", middleware.RequireRole("user", controller.GetUser)).Methods("GET")
	router.HandleFunc("/user/{cid}", middleware.RequireRole("user", controller.UpdateUser)).Methods("PUT")
	router.HandleFunc("/user/logout", middleware.RequireRole("user", controller.LogoutUser)).Methods("POST")

	// Appointments — patients
	router.HandleFunc("/appointment", middleware.RequireRole("user", controller.AddAppointment)).Methods("POST")
	router.HandleFunc("/appointment/{aptId}", middleware.RequireRole("user", controller.GetAppointment)).Methods("GET")
	router.HandleFunc("/appointment/{aptId}", middleware.RequireRole("user", controller.DeleteAppointment)).Methods("DELETE")

	// DOCTOR ROUTES — must be logged in as "doctor"
	router.HandleFunc("/doctor/dashboard", middleware.RequireRole("doctor", controller.GetDoctorDashboard)).Methods("GET")
	router.HandleFunc("/doctor/logout", middleware.RequireRole("doctor", controller.LogoutDoctor)).Methods("POST")
	router.HandleFunc("/doctor/appointments", middleware.RequireRole("doctor", controller.GetAllAppointments)).Methods("GET")
	router.HandleFunc("/doctor/appointments/by-date", middleware.RequireRole("doctor", controller.GetAppointmentsByDate)).Methods("GET")
	router.HandleFunc("/doctor/appointment/{aptId}", middleware.RequireRole("doctor", controller.UpdateAppointment)).Methods("PUT")
	router.HandleFunc("/doctor/appointment/{aptId}/status", middleware.RequireRole("doctor", controller.UpdateAppointmentStatus)).Methods("POST")
	router.HandleFunc("/doctor/chamber/{chamberId}/appointments", middleware.RequireRole("doctor", controller.GetChamberAppointments)).Methods("GET")
	router.HandleFunc("/doctor/chamber/{chamberId}/patients",     middleware.RequireRole("doctor", controller.GetDoctorPatients)).Methods("GET")
	router.HandleFunc("/doctor/chamber/{chamberId}/activity",     middleware.RequireRole("doctor", controller.GetDoctorActivity)).Methods("GET")

	// ADMIN ROUTES — must be logged in as "admin"
	router.HandleFunc("/admin/logout", middleware.RequireRole("admin", controller.LogoutAdmin)).Methods("POST")
	router.HandleFunc("/admin/dashboard", middleware.RequireRole("admin", controller.GetAdminDashboard)).Methods("GET")
	router.HandleFunc("/admin/activity", middleware.RequireRole("admin", controller.GetAdminActivity)).Methods("GET")
	router.HandleFunc("/admin/settings/profile", middleware.RequireRole("admin", controller.GetAdminProfileHandler)).Methods("GET")
	router.HandleFunc("/admin/settings/hospital-name", middleware.RequireRole("admin", controller.GetHospitalConfigHandler)).Methods("GET")
	router.HandleFunc("/admin/settings/hospital-name", middleware.RequireRole("admin", controller.SetHospitalConfigHandler)).Methods("POST")
	router.HandleFunc("/admin/settings/email", middleware.RequireRole("admin", controller.UpdateAdminEmailHandler)).Methods("POST")
	router.HandleFunc("/admin/settings/password", middleware.RequireRole("admin", controller.UpdateAdminPasswordHandler)).Methods("POST")

	// Appointments — admin
	router.HandleFunc("/admin/appointments", middleware.RequireRole("admin", controller.GetAllAppointments)).Methods("GET")
	router.HandleFunc("/admin/appointment/{aptId}", middleware.RequireRole("admin", controller.UpdateAppointment)).Methods("PUT")
	router.HandleFunc("/admin/appointment/{aptId}", middleware.RequireRole("admin", controller.DeleteAppointment)).Methods("DELETE")
	router.HandleFunc("/admin/appointment/{aptId}/status", middleware.RequireRole("admin", controller.UpdateAppointmentStatus)).Methods("POST")

	// Chambers — admin
	router.HandleFunc("/admin/chambers", middleware.RequireRole("admin", controller.GetAllChambers)).Methods("GET")
	router.HandleFunc("/admin/chamber", middleware.RequireRole("admin", controller.AddChamber)).Methods("POST")
	router.HandleFunc("/admin/chamber/{chamberId}", middleware.RequireRole("admin", controller.UpdateChamber)).Methods("PUT")
	router.HandleFunc("/admin/chamber/{chamberId}", middleware.RequireRole("admin", controller.DeleteChamber)).Methods("DELETE")
	router.HandleFunc("/admin/chamber/{chamberId}/assign-doctor", middleware.RequireRole("admin", controller.AssignDoctor)).Methods("POST")
	router.HandleFunc("/admin/chamber/{chamberId}/remove-doctor", middleware.RequireRole("admin", controller.RemoveDoctor)).Methods("POST")

	// Doctors — admin
	router.HandleFunc("/admin/doctors", middleware.RequireRole("admin", controller.GetAllDoctors)).Methods("GET")
	router.HandleFunc("/admin/doctor", middleware.RequireRole("admin", controller.AddDoctor)).Methods("POST")
	router.HandleFunc("/admin/doctor/{doctorId}", middleware.RequireRole("admin", controller.UpdateDoctor)).Methods("PUT")
	router.HandleFunc("/admin/doctor/{doctorId}", middleware.RequireRole("admin", controller.DeleteDoctor)).Methods("DELETE")

	// SHARED — any logged in role
	router.HandleFunc("/chambers/available", middleware.AuthMiddleware(controller.GetAvailableChambers)).Methods("GET")
	router.HandleFunc("/patient/appointments/{cid}", middleware.RequireRole("user", controller.GetPatientAppointments)).Methods("GET")
	router.HandleFunc("/api/booked-slots", middleware.AuthMiddleware(controller.GetBookedSlots)).Methods("GET")

	// STATIC FILES — frontend HTML/CSS/JS
	// no-cache wrapper forces browsers to always fetch fresh JS/CSS files
	fhandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		http.FileServer(http.Dir("./views")).ServeHTTP(w, r)
	})
	router.PathPrefix("/").Handler(fhandler)

	log.Println("Application running on port 8080")
	log.Fatal(http.ListenAndServe(":8080", router))
}