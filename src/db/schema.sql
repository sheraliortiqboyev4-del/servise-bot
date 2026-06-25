-- Foydalanuvchilar
CREATE TABLE IF NOT EXISTS users (
  id           BIGSERIAL PRIMARY KEY,
  telegram_id  BIGINT UNIQUE NOT NULL,
  full_name    TEXT NOT NULL,
  role         TEXT NOT NULL,            -- driver | worker | admin
  status       TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  phone        TEXT,
  location     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Zayavkalar
CREATE TABLE IF NOT EXISTS requests (
  id              BIGSERIAL PRIMARY KEY,
  code            TEXT UNIQUE NOT NULL,   -- REQ-1001
  driver_id       BIGINT NOT NULL REFERENCES users(id),
  request_type    TEXT,
  unit_number     TEXT,
  trailer_number  TEXT,
  driver_name     TEXT,
  driver_phone    TEXT,
  location        TEXT,
  priority        TEXT,
  description     TEXT,
  notes           TEXT,
  photo_file_ids  JSONB NOT NULL DEFAULT '[]', -- Array of photo file IDs for request
  status          TEXT NOT NULL DEFAULT 'open',
  accepted_by     BIGINT REFERENCES users(id),
  resolved_photo_ids  JSONB NOT NULL DEFAULT '[]', -- Array of photo file IDs for resolved request
  cancel_reason   TEXT,
  channel_msg_id  BIGINT,                 -- kanaldagi post message_id
  group_msg_id    BIGINT,                 -- guruhga forward qilingan post message_id
  sla_notified    BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at     TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_driver ON requests(driver_id);

-- Sozlamalar (key-value, admin panel orqali o'zgartiriladi)
CREATE TABLE IF NOT EXISTS settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
