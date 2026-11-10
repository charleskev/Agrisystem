# Damage Monitoring and Tracking

This feature bundle includes the farmer-facing **My Damage Reports** page and the MAO staff review workflow that supplies its status, feedback, and review history.

Farmers can monitor pending, reviewing, resolved, and rejected reports; search and filter records; inspect photos, incident details, MAO feedback, and review history; export the list as CSV; and print or save an individual report as PDF. MAO staff can inspect submitted reports and record review decisions, remarks, and actions taken.

## Included files

- `client/src/pages/DamageMonitoringPage.jsx` — farmer report tracking page.
- `client/src/pages/StaffPages.jsx` — MAO review page and report details.
- `client/src/App.jsx` — connects both pages to the existing routes.
- `client/src/components/AppShell.jsx` and `StatusBadge.jsx` — review navigation and report status display.
- `server/src/api/routes/reportRoutes.js`, `controllers/reportController.js`, and `models/reportModel.js` — authenticated report API and data access.
- `server/src/app.js` — registers the report API.
- `server/db/migrations/013_report_scan_review_history.sql` — report review fields and history table.

## Integrate with AgriSystem

Copy the files to the same paths in the AgriSystem project. The pages rely on its existing authentication, API helper, realtime hook, shared layout components, Leaflet setup, and farmer/land/crop models. Run the SQL migration before using review history, remarks, and actions-taken fields. The existing `#my-reports` and `#review` routes open the farmer and staff pages.
