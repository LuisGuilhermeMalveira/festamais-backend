-- Users (Empresas/Locadores)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Subscription Plans
CREATE TABLE subscription_plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  max_users INT,
  max_items INT DEFAULT 9999,
  features JSONB,
  stripe_price_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Subscriptions
CREATE TABLE user_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  plan_id INT NOT NULL REFERENCES subscription_plans(id),
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active', -- active, canceled, expired
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Clientes
CREATE TABLE clients (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Catálogo (Items)
CREATE TABLE catalog_items (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  price_per_day DECIMAL(10, 2) NOT NULL,
  unit VARCHAR(50),
  stock_total INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Orçamentos
CREATE TABLE quotations (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  client_id INT REFERENCES clients(id),
  client_name VARCHAR(255) NOT NULL,
  client_phone VARCHAR(20),
  event_type VARCHAR(100),
  event_date DATE NOT NULL,
  location TEXT,
  items JSONB NOT NULL, -- [{id, name, qty, unit, price}, ...]
  subtotal DECIMAL(10, 2),
  days INT,
  discount DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  notes TEXT,
  status VARCHAR(50) DEFAULT 'Pendente', -- Pendente, Confirmado, Cancelado
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Eventos (criados ao confirmar orçamento)
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  quotation_id INT REFERENCES quotations(id),
  client_id INT REFERENCES clients(id),
  client_name VARCHAR(255) NOT NULL,
  event_type VARCHAR(100),
  event_date DATE NOT NULL,
  time VARCHAR(10) DEFAULT '18:00',
  total_value DECIMAL(10, 2),
  signal_received DECIMAL(10, 2) DEFAULT 0,
  notes TEXT,
  items JSONB NOT NULL, -- Itens do orçamento
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Pagamentos/Financeiro
CREATE TABLE financial_records (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  event_id INT REFERENCES events(id),
  client_id INT REFERENCES clients(id),
  total_value DECIMAL(10, 2),
  signal_received DECIMAL(10, 2) DEFAULT 0,
  remaining_balance DECIMAL(10, 2),
  status VARCHAR(50) DEFAULT 'Pendente', -- Pendente, Quitado
  event_date DATE,
  paid_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_clients_user_id ON clients(user_id);
CREATE INDEX idx_catalog_user_id ON catalog_items(user_id);
CREATE INDEX idx_quotations_user_id ON quotations(user_id);
CREATE INDEX idx_quotations_status ON quotations(status);
CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_financial_user_id ON financial_records(user_id);
CREATE INDEX idx_financial_status ON financial_records(status);
CREATE INDEX idx_subscriptions_user_id ON user_subscriptions(user_id);
