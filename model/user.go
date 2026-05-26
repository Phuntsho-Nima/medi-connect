package model

import (
	"database/sql"
	"hospitalOPD/dataStore/postgres"
)

type User struct {
	Cid       string `json:"cid"`
	Name      string `json:"name"`
	Gender    string `json:"gender"`
	DOB       string `json:"dob"`
	Gewog     string `json:"gewog"`
	Dzongkhag string `json:"dzongkhag"`
	Password  string `json:"password,omitempty"`
}

type UserPhone struct {
	Cid     string `json:"cid"`
	PhoneNo string `json:"phoneNo"`
}

const queryInsertUser = `
	INSERT INTO users (CID, name, DOB, gender, gewog, dzongkhag, password)
	VALUES ($1, $2, $3, $4, $5, $6, $7);`

func (u *User) Create() error {
	_, err := postgres.Db.Exec(
		queryInsertUser,
		u.Cid, u.Name, u.DOB, u.Gender, u.Gewog, u.Dzongkhag, u.Password,
	)
	return err
}

const queryGetUserByCID = `
	SELECT CID, name, DOB, gender, gewog, dzongkhag
	FROM users WHERE CID = $1;`

func (u *User) Read() error {
	return postgres.Db.QueryRow(queryGetUserByCID, u.Cid).Scan(
		&u.Cid, &u.Name, &u.DOB, &u.Gender, &u.Gewog, &u.Dzongkhag,
	)
}

const queryUpdateUser = `
	UPDATE users
	SET name = $1, DOB = $2, gender = $3, gewog = $4, dzongkhag = $5
	WHERE CID = $6
	RETURNING CID;`

func (u *User) Update() error {
	return postgres.Db.QueryRow(
		queryUpdateUser,
		u.Name, u.DOB, u.Gender, u.Gewog, u.Dzongkhag, u.Cid,
	).Scan(&u.Cid)
}

const queryDeleteUser = `
	DELETE FROM users WHERE CID = $1 RETURNING CID;`

func (u *User) Delete() error {
	return postgres.Db.QueryRow(queryDeleteUser, u.Cid).Scan(&u.Cid)
}

const queryGetAllUsers = `
	SELECT CID, name, DOB, gender, gewog, dzongkhag
	FROM users ORDER BY name;`

func ReadAllUsers() ([]User, error) {
	rows, err := postgres.Db.Query(queryGetAllUsers)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.Cid, &u.Name, &u.DOB, &u.Gender, &u.Gewog, &u.Dzongkhag); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, nil
}

const queryInsertPhone = `
	INSERT INTO user_phone_no (phone_no, CID) VALUES ($1, $2);`

func AddPhone(cid string, phoneNo string) error {
	_, err := postgres.Db.Exec(queryInsertPhone, phoneNo, cid)
	return err
}

const queryGetPhones = `
	SELECT phone_no FROM user_phone_no WHERE CID = $1;`

func GetPhones(cid string) ([]string, error) {
	rows, err := postgres.Db.Query(queryGetPhones, cid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var phones []string
	for rows.Next() {
		var phone string
		if err := rows.Scan(&phone); err != nil {
			return nil, err
		}
		phones = append(phones, phone)
	}
	return phones, nil
}

const queryLogin = `
	SELECT CID, name, DOB, gender, gewog, dzongkhag
	FROM users WHERE CID = $1 AND password = $2;`

func UserLogin(cid string, password string) (*User, error) {
	var u User
	err := postgres.Db.QueryRow(queryLogin, cid, password).Scan(
		&u.Cid, &u.Name, &u.DOB, &u.Gender, &u.Gewog, &u.Dzongkhag,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

const queryCheckCID = `
	SELECT COUNT(*) FROM users WHERE CID = $1;`

func CIDExists(cid string) (bool, error) {
	var count int
	err := postgres.Db.QueryRow(queryCheckCID, cid).Scan(&count)
	return count > 0, err
}