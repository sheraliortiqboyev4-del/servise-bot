-- Cancel reason column'ini qo'shish
ALTER TABLE requests ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
