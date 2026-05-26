-- =============================================================
-- Healthcare Management System — Seed Data
-- Run AFTER schema.sql
-- =============================================================
-- TEST CREDENTIALS:
-- Patient  — CID: 10101010101  password: patient123
-- Admin    — email: admin@hospital.com  password: admin123
-- Doctor   — (login via doctor_id, check below)  password: doctor123
-- =============================================================

-- All passwords are sha256 hashes
-- patient123 = sha256("patient123") 
-- admin123   = sha256("admin123")
-- doctor123  = sha256("doctor123")

-- =============================================================
-- CLEAR ALL DATA (order matters due to foreign keys)
-- =============================================================
TRUNCATE TABLE
    record_prescription,
    records,
    appointments,
    user_phone_no,
    users,
    chamber_doctors,
    chambers,
    doctors,
    admin_email,
    admins,
    departments
RESTART IDENTITY CASCADE;

-- =============================================================
-- DEPARTMENTS
-- =============================================================
INSERT INTO departments (department_name, ddescription, location, contact_no) VALUES
('General OPD',       'General outpatient department for common illnesses',    'Block A, Ground Floor', '02-123456'),
('Cardiology',        'Heart and cardiovascular disease treatment',             'Block B, 1st Floor',    '02-123457'),
('Orthopedics',       'Bone, joint and muscle disorders',                      'Block C, 2nd Floor',    '02-123458'),
('Pediatrics',        'Medical care for infants, children and adolescents',    'Block A, 1st Floor',    '02-123459'),
('Dermatology',       'Skin, hair and nail conditions',                        'Block D, Ground Floor', '02-123460');

-- =============================================================
-- ADMINS
-- password: admin123 → sha256 hex
-- =============================================================
INSERT INTO admins (name, password) VALUES
('Dr. Karma Wangchuk', encode(sha256('admin123'::bytea), 'hex')),
('Sonam Dema',         encode(sha256('admin123'::bytea), 'hex'));

-- Admin emails
INSERT INTO admin_email (email, admin_id) VALUES
('admin@hospital.com',  1),
('sonam@hospital.com',  2);

-- =============================================================
-- DOCTORS
-- password: doctor123 → sha256 hex
-- =============================================================
INSERT INTO doctors (name, specialization, department_id, password) VALUES
('Dr. Tenzin Norbu',    'General Physician',       1, encode(sha256('doctor123'::bytea), 'hex')),
('Dr. Pema Lhamo',      'Cardiologist',            2, encode(sha256('doctor123'::bytea), 'hex')),
('Dr. Karma Dorji',     'Orthopedic Surgeon',      3, encode(sha256('doctor123'::bytea), 'hex')),
('Dr. Deki Yangzom',    'Pediatrician',            4, encode(sha256('doctor123'::bytea), 'hex')),
('Dr. Rinzin Wangdi',   'Dermatologist',           5, encode(sha256('doctor123'::bytea), 'hex'));

-- =============================================================
-- CHAMBERS
-- =============================================================
INSERT INTO chambers (chamber_name, availability_status, department_id) VALUES
('Chamber 1 — General',     'Available',   1),
('Chamber 2 — General',     'Available',   1),
('Chamber 3 — Cardiology',  'Available',   2),
('Chamber 4 — Orthopedics', 'Available',   3),
('Chamber 5 — Pediatrics',  'Available',   4),
('Chamber 6 — Dermatology', 'Unavailable', 5);

-- =============================================================
-- CHAMBER DOCTORS (assign doctors to chambers)
-- =============================================================
INSERT INTO chamber_doctors (chamber_no, doctor_id) VALUES
(1, 1),  -- Dr. Tenzin Norbu → Chamber 1 General
(2, 1),  -- Dr. Tenzin Norbu → Chamber 2 General
(3, 2),  -- Dr. Pema Lhamo   → Chamber 3 Cardiology
(4, 3),  -- Dr. Karma Dorji  → Chamber 4 Orthopedics
(5, 4),  -- Dr. Deki Yangzom → Chamber 5 Pediatrics
(6, 5);  -- Dr. Rinzin Wangdi→ Chamber 6 Dermatology

-- =============================================================
-- USERS (Patients)
-- password: patient123 → sha256 hex
-- CID format: 11 digit string
-- =============================================================
INSERT INTO users (CID, name, dob, gender, password) VALUES
('10101010101', 'Karma Tshering',   '1990-05-15', 'Male',   encode(sha256('patient123'::bytea), 'hex')),
('10101010102', 'Pema Seldon',      '1985-08-22', 'Female', encode(sha256('patient123'::bytea), 'hex')),
('10101010103', 'Tashi Wangchuk',   '1978-11-03', 'Male',   encode(sha256('patient123'::bytea), 'hex')),
('10101010104', 'Dechen Lhamo',     '2000-02-17', 'Female', encode(sha256('patient123'::bytea), 'hex')),
('10101010105', 'Sonam Tobgay',     '1995-07-30', 'Male',   encode(sha256('patient123'::bytea), 'hex'));

-- User phone numbers
INSERT INTO user_phone_no (phone_no, CID) VALUES
('17123456', '10101010101'),
('17234567', '10101010102'),
('17345678', '10101010103'),
('17456789', '10101010104'),
('17567890', '10101010105');

-- =============================================================
-- APPOINTMENTS
-- Mix of statuses for testing all views
-- =============================================================
INSERT INTO appointments (appointment_date, appointment_time, status, CID, admin_id, chamber_no) VALUES
(CURRENT_DATE,          '09:00:00', 'Pending',   '10101010101', 1, 1),
(CURRENT_DATE,          '10:00:00', 'Pending',   '10101010102', 1, 1),
(CURRENT_DATE,          '11:00:00', 'Completed', '10101010103', 1, 3),
(CURRENT_DATE - 1,      '09:30:00', 'Completed', '10101010101', 1, 2),
(CURRENT_DATE - 1,      '14:00:00', 'Cancelled', '10101010104', 2, 4),
(CURRENT_DATE + 1,      '09:00:00', 'Pending',   '10101010105', 1, 5),
(CURRENT_DATE + 2,      '10:30:00', 'Pending',   '10101010102', 1, 3);

-- =============================================================
-- RECORDS (Medical records)
-- =============================================================
INSERT INTO records (record_date, diagnosis, treatment, doctor_notes, CID, admin_id) VALUES
(CURRENT_DATE - 1, 'Common Cold',        'Rest and fluids, Paracetamol 500mg',    'Patient advised to rest for 3 days',         '10101010101', 1),
(CURRENT_DATE - 1, 'Hypertension',       'Amlodipine 5mg daily',                  'Blood pressure 140/90, monitor weekly',      '10101010103', 1),
(CURRENT_DATE - 7, 'Sprained Ankle',     'Ice pack, Ibuprofen 400mg, rest',       'X-ray clear, no fracture detected',          '10101010104', 2);

-- Record prescriptions
INSERT INTO record_prescription (prescription, record_id) VALUES
('Paracetamol 500mg — twice daily after meals for 5 days',  1),
('Vitamin C 1000mg — once daily for 7 days',                1),
('Amlodipine 5mg — once daily in the morning',              2),
('Ibuprofen 400mg — three times daily after meals',         3),
('Topical pain relief gel — apply twice daily',             3);

UPDATE admins SET password = 'admin123';
UPDATE doctors SET password = 'doctor123';