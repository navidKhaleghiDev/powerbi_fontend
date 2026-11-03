CREATE TABLE IF NOT EXISTS staff (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(120),
    role VARCHAR(80),
    hire_date DATE
);

CREATE TABLE IF NOT EXISTS payroll (
    id SERIAL PRIMARY KEY,
    staff_id INT REFERENCES staff(id),
    amount DECIMAL(10,2),
    month VARCHAR(20)
);

INSERT INTO staff (full_name, role, hire_date) VALUES
('Navid Moradi', 'Data Engineer', '2023-01-15'),
('Fatemeh Nouri', 'HR Manager', '2022-05-20'),
('Hossein Ghorbani', 'Analyst', '2024-02-10');

INSERT INTO payroll (staff_id, amount, month) VALUES
(1, 4200.00, '2026-01'),
(2, 5800.00, '2026-01'),
(3, 3500.00, '2026-01');
