package postgres

import (
	"database/sql"
	"log"
	"os"

	_ "github.com/lib/pq"
)

var Db *sql.DB

func init() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL environment variable is not set")
	}

	var err error
	Db, err = sql.Open("postgres", dbURL)
	if err != nil {
		panic(err)
	}

	if err = Db.Ping(); err != nil {
		panic(err)
	}

	log.Println("Database successfully connected")
}
