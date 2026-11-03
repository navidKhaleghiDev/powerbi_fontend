CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120),
    region VARCHAR(60)
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(id),
    total DECIMAL(12,2),
    status VARCHAR(20)
);

INSERT INTO customers (name, region) VALUES
('TechCorp Ltd', 'Tehran'),
('GreenWave Co', 'Isfahan'),
('BlueStar Inc', 'Shiraz');

INSERT INTO orders (customer_id, total, status) VALUES
(1, 12500.00, 'completed'),
(2, 8400.00, 'pending'),
(3, 15600.00, 'completed');
