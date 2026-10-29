# AgriSystem database migrations

The active AgriSystem API uses MySQL (`server/src/config/db.js`) and the migration runner in `server/scripts/migrate.js`. Migrations are applied in filename order and recorded in `schema_migrations`; existing business tables are not dropped.

From the project root, apply pending migrations with:

```powershell
npm --prefix server run migrate
```

The `010_sms_security.sql` migration adds OTP verification state and request throttles, staff SMS preferences, and SMS request logs. The `011_farm_boundaries.sql` migration adds polygon and area fields to existing land records. The `012_land_measurement_history.sql` migration preserves prior mapped boundary measurements when a farm is remapped. The `013_report_scan_review_history.sql` migration links reports to saved crop detections and adds non-destructive staff action history. Apply migrations after the preceding files. The MySQL database name and credentials come from the root `.env` values `MYSQL_DATABASE`, `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, and `MYSQL_PASSWORD` (the code defaults to `agrisystem`, `localhost:3306`, and `root` with an empty password when omitted).

For Laragon, start MySQL, confirm the database and account in Laragon or phpMyAdmin, configure the matching values in the root `.env`, then run the command above. In phpMyAdmin, the equivalent is to select the configured database and import `010_sms_security.sql` after its earlier migrations.
