CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    budget DECIMAL(15,2)
);

CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    department_id INT REFERENCES departments(id),
    salary DECIMAL(10,2)
);

INSERT INTO departments (name, budget) VALUES
('Engineering', 1200000.00),
('Marketing', 450000.00),
('Sales', 680000.00);

INSERT INTO employees (name, department_id, salary) VALUES
('Ali Rahimi', 1, 85000.00),
('Sara Ahmadi', 2, 62000.00),
('Reza Kiani', 1, 92000.00),
('Mina Zarei', 3, 71000.00);
