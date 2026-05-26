
CREATE TABLE users (
    CID         VARCHAR(11)  PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    DOB         DATE         NOT NULL,
    gender      VARCHAR(10)  NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
    gewog       VARCHAR(100),
    dzongkhag   VARCHAR(100),
    password    VARCHAR(255) NOT NULL  
);

CREATE TABLE user_phone_no (
    phone_no    VARCHAR(20)  NOT NULL,
    CID         VARCHAR(11)  NOT NULL REFERENCES users(CID) ON DELETE CASCADE,
    PRIMARY KEY (phone_no, CID)
);


CREATE TABLE admins (
    admin_id    SERIAL       PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    password    VARCHAR(255) NOT NULL  
);

CREATE TABLE admin_email (
    email       VARCHAR(150) NOT NULL,
    admin_id    INTEGER      NOT NULL REFERENCES admins(admin_id) ON DELETE CASCADE,
    PRIMARY KEY (email)
);


CREATE TABLE departments (
    department_id   SERIAL       PRIMARY KEY,
    department_name VARCHAR(100) NOT NULL,
    ddescription    TEXT,
    location        VARCHAR(150),
    contact_no      VARCHAR(20)
);


CREATE TABLE doctors (
    doctor_id       SERIAL       PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    specialization  VARCHAR(100),
    department_id   INTEGER      REFERENCES departments(department_id) ON DELETE SET NULL,
    password        VARCHAR(255) NOT NULL  
);

CREATE TABLE chambers (
    chamber_no          SERIAL       PRIMARY KEY,
    chamber_name        VARCHAR(100) NOT NULL,
    availability_status VARCHAR(20)  NOT NULL DEFAULT 'Available' CHECK (availability_status IN ('Available', 'Unavailable')),
    department_id       INTEGER      REFERENCES departments(department_id) ON DELETE SET NULL
);

CREATE TABLE chamber_doctors (
    chamber_no  INTEGER NOT NULL REFERENCES chambers(chamber_no) ON DELETE CASCADE,
    doctor_id   INTEGER NOT NULL REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    PRIMARY KEY (chamber_no, doctor_id)
);

CREATE TABLE appointments (
    appointment_id      SERIAL      PRIMARY KEY,
    appointment_date    DATE        NOT NULL,
    appointment_time    TIME        NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Completed', 'Cancelled')),
    CID                 VARCHAR(11) NOT NULL REFERENCES users(CID) ON DELETE CASCADE,
    admin_id            INTEGER     REFERENCES admins(admin_id) ON DELETE SET NULL,
    chamber_no          INTEGER     NOT NULL REFERENCES chambers(chamber_no) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_appointment_slot
    ON appointments(chamber_no, appointment_date, appointment_time)
    WHERE status != 'Cancelled';

CREATE TABLE records (
    record_id       SERIAL      PRIMARY KEY,
    record_date     DATE        NOT NULL DEFAULT CURRENT_DATE,
    diagnosis       TEXT,
    treatment       TEXT,
    doctor_notes    TEXT,
    CID             VARCHAR(11) NOT NULL REFERENCES users(CID) ON DELETE CASCADE,
    admin_id        INTEGER     REFERENCES admins(admin_id) ON DELETE SET NULL
);

CREATE TABLE record_prescription (
    prescription    TEXT        NOT NULL,
    record_id       INTEGER     NOT NULL REFERENCES records(record_id) ON DELETE CASCADE,
    PRIMARY KEY (prescription, record_id)
);

CREATE TABLE sessions (
    token       VARCHAR(64)  PRIMARY KEY,
    role        VARCHAR(10)  NOT NULL CHECK (role IN ('user', 'admin', 'doctor')),
    user_ref    VARCHAR(11),   -- CID for users
    admin_ref   INTEGER,       -- admin_id for admins
    doctor_ref  INTEGER,       -- doctor_id for doctors
    expires_at  TIMESTAMP    NOT NULL
);

CREATE INDEX idx_appointments_CID        ON appointments(CID);
CREATE INDEX idx_appointments_chamber    ON appointments(chamber_no);
CREATE INDEX idx_appointments_date       ON appointments(appointment_date);
CREATE INDEX idx_records_CID             ON records(CID);
CREATE INDEX idx_chambers_department     ON chambers(department_id);