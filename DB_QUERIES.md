# Rooster Booster — Useful Database Queries
Use these in the Railway database query interface (plain SQL only — no \d commands).

---

## See All Tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

---

## See All Columns in a Table
-- Swap the table name in quotes as needed
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'your_table_name'
ORDER BY ordinal_position;

---

## See Constraints on a Table
-- Useful for checking unique keys and primary keys
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'your_table_name';

---

## See All Rows in a Table
SELECT * FROM your_table_name;

---

## Check a Specific Contractor's CRM Settings
SELECT * FROM contractor_crm_settings 
WHERE contractor_id = 'accent-roofing';

---

## Check Token Status
SELECT contractor_id, expires_at, updated_at 
FROM tokens;
