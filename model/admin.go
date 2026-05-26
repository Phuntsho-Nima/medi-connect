package model

import (
	"database/sql"
	"hospitalOPD/dataStore/postgres"
)

type Admin struct {
	AdminId  int    `json:"adminId"`
	Name     string `json:"name"`
	Password string `json:"password,omitempty"`
	Email    string `json:"email"`
}

const queryInsertAdmin = `
	INSERT INTO admins (name, password)
	VALUES ($1, $2)
	RETURNING admin_id;`

func (a *Admin) Create() error {
	return postgres.Db.QueryRow(queryInsertAdmin, a.Name, a.Password).Scan(&a.AdminId)
}

const queryInsertAdminEmail = `
	INSERT INTO admin_email (email, admin_id) VALUES ($1, $2);`

func AddAdminEmail(adminId int, email string) error {
	_, err := postgres.Db.Exec(queryInsertAdminEmail, email, adminId)
	return err
}

const queryGetAdminById = `
	SELECT a.admin_id, a.name, COALESCE(e.email, '') as email
	FROM admins a
	LEFT JOIN admin_email e ON a.admin_id = e.admin_id
	WHERE a.admin_id = $1
	LIMIT 1;`

func (a *Admin) Read() error {
	return postgres.Db.QueryRow(queryGetAdminById, a.AdminId).Scan(
		&a.AdminId, &a.Name, &a.Email,
	)
}

const queryUpdateAdmin = `
	UPDATE admins SET name = $1 WHERE admin_id = $2 RETURNING admin_id;`

func (a *Admin) Update() error {
	return postgres.Db.QueryRow(queryUpdateAdmin, a.Name, a.AdminId).Scan(&a.AdminId)
}

const queryGetAllAdmins = `
	SELECT a.admin_id, a.name, COALESCE(e.email, '') as email
	FROM admins a
	LEFT JOIN admin_email e ON a.admin_id = e.admin_id
	ORDER BY a.admin_id;`

func ReadAllAdmins() ([]Admin, error) {
	rows, err := postgres.Db.Query(queryGetAllAdmins)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var admins []Admin
	for rows.Next() {
		var a Admin
		if err := rows.Scan(&a.AdminId, &a.Name, &a.Email); err != nil {
			return nil, err
		}
		admins = append(admins, a)
	}
	return admins, nil
}

const queryAdminLogin = `
	SELECT a.admin_id, a.name
	FROM admins a
	JOIN admin_email e ON a.admin_id = e.admin_id
	WHERE e.email = $1 AND a.password = $2;`

func AdminLogin(email string, password string) (*Admin, error) {
	var a Admin
	err := postgres.Db.QueryRow(queryAdminLogin, email, password).Scan(&a.AdminId, &a.Name)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	a.Email = email
	return &a, nil
}