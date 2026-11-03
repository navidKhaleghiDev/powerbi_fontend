#!/usr/bin/env bash
set -euo pipefail
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 <<'SQL'
\getenv cdc_password CDC_PASSWORD
SELECT format('CREATE ROLE bi_cdc LOGIN REPLICATION PASSWORD %L', :'cdc_password') \gexec
GRANT CREATE ON DATABASE bi_source TO bi_cdc;
CREATE SCHEMA sales AUTHORIZATION bi_cdc;
SET ROLE bi_cdc;
CREATE TABLE sales.orders (
  order_id text PRIMARY KEY,
  customer_id text NOT NULL,
  city text NOT NULL,
  status text NOT NULL,
  total_amount numeric(18,2) NOT NULL CHECK (total_amount >= 0),
  order_date date NOT NULL
);
INSERT INTO sales.orders VALUES
('ord-1001','cust-1','Tehran','paid',120.50,'2026-11-01'),
('ord-1002','cust-2','Shiraz','paid',89.50,'2026-11-01'),
('ord-1003','cust-1','Tehran','paid',250.00,'2026-11-01'),
('ord-1004','cust-3','Tabriz','shipped',300.00,'2026-11-01'),
('ord-1005','cust-4','Isfahan','pending',45.00,'2026-11-02'),
('ord-1006','cust-2','Shiraz','paid',175.00,'2026-11-02'),
('ord-1007','cust-5','Mashhad','shipped',500.00,'2026-11-02'),
('ord-1008','cust-3','Tabriz','pending',99.99,'2026-11-02');
ALTER TABLE sales.orders REPLICA IDENTITY FULL;
RESET ROLE;
SQL
