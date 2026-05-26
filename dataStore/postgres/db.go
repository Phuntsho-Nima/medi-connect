package postgres

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/lib/pq"
)

const(
	postgres_host = "db"
	postgres_port = 5432
	postgres_user = "postgres"
	postgres_password = "postgres"
	postgres_dbname = "hospital_opd"
)

var Db *sql.DB

func init(){
	db_info := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable", postgres_host, postgres_port, postgres_user, postgres_password, postgres_dbname)
	var err error
	Db,err = sql.Open("postgres", db_info)
	if err != nil{
		panic(err)
	} else {
		log.Println("Database successfully connected")
	}
}

// package postgres

// import (
// 	"database/sql"
// 	"log"
// 	"os"

// 	_ "github.com/lib/pq"
// )

// var Db *sql.DB

// func init() {
// 	// Look for the DATABASE_URL environment variable
// 	dbURL := os.Getenv("DATABASE_URL")

// 	// Fallback default if the environment variable is not set
// 	if dbURL == "" {
// 		dbURL = "postgres://postgres:postgres@db:5432/hospital_opd?sslmode=disable"
// 		log.Println("DATABASE_URL not set, using default local connection string")
// 	}

// 	var err error
// 	Db, err = sql.Open("postgres", dbURL)
// 	if err != nil {
// 		panic(err)
// 	}

// 	// sql.Open doesn't actually establish a connection immediately.
// 	// It is highly recommended to Ping the database to verify it's reachable.
// 	err = Db.Ping()
// 	if err != nil {
// 		panic(err)
// 	}

// 	log.Println("Database successfully connected")
// }
