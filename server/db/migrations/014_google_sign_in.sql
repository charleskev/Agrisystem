ALTER TABLE users
  ADD COLUMN google_sub VARCHAR(255) NULL,
  ADD UNIQUE KEY uq_users_google_sub (google_sub);
