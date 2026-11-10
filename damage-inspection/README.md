# Damage Inspection contribution

This folder contains the files for the MAO staff damage-inspection workflow:

- View, filter, and inspect farmer damage reports.
- Open evidence photos, farm boundaries, GPS locations, AI labels, and report history.
- Update a report as pending, reviewing, resolved, or rejected.
- Save final crop and damage labels, staff remarks, and actions taken.

## Files to merge into the team project

The folders deliberately match the AgriSystem project paths. Copy each file into the matching path in the team repository.

| File | Purpose |
| --- | --- |
| `client/src/pages/StaffPages.jsx` | Review Reports screen and inspection details |
| `client/src/App.jsx` | `#review` page route |
| `client/src/components/AppShell.jsx` | Review Reports sidebar entry |
| `client/src/components/StatusBadge.jsx` | Review status labels and colors |
| `server/src/app.js` | Registers the report API routes |
| `server/src/api/routes/reportRoutes.js` | Staff list and review endpoints |
| `server/src/api/controllers/reportController.js` | Review validation and response handling |
| `server/src/api/models/reportModel.js` | Report, evidence, and review-history queries |
| `server/db/migrations/013_report_scan_review_history.sql` | Database fields and review-history table |

Run the SQL migration once before using the review history, staff remarks, and actions-taken fields.

This is a feature bundle for the existing AgriSystem project. It relies on the project's shared components, authentication middleware, API helper, realtime hook, and report tables.
