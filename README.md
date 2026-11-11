# AgriSystem

AgriSystem is a farmer information and agriculture reporting portal for the Municipal Agriculture Office of Bongabong, Oriental Mindoro. The active web application uses the React client in `client/` and the Express/MySQL API in `server/`. Older XianFire files at the repository root are retained for reference.

## Run locally

1. Start MySQL and copy `.env.example` to `.env` in the project root. Set `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`, and `JWT_SECRET` to match your setup.
2. Install the root, server, and client dependencies if needed:

   ```powershell
   npm install
   npm --prefix server install
   npm --prefix client install
   ```

3. Create/update the database tables:

   ```powershell
   npm --prefix server run migrate
   ```

4. Start the API and web client:

   ```powershell
   npm run agri:dev
   ```

Open `http://localhost:5173`. The API runs at `http://localhost:4000`.

## Google Sign-In setup

Google Sign-In uses the official Google Identity Services button. The browser sends its ID token to the API, where Google's signature, issuer, expiry, and client ID audience are verified before AgriSystem creates its own session. The feature signs into existing accounts only; it does not create a user or assign a role.

1. In [Google Cloud Console](https://console.cloud.google.com/), select or create a project, configure the OAuth consent screen / Google Auth Platform branding, then create an OAuth client ID with application type **Web application**. Add test users if the consent screen is in External testing mode.
2. Under **Authorized JavaScript origins**, add `http://localhost:5173`. Add the exact HTTPS origin of the deployed AgriSystem frontend for production. Set the server's `CLIENT_ORIGIN` in the root `.env` to that same frontend origin so API CORS accepts requests from desktop and mobile browsers. This popup-based integration does not need an authorized redirect URI. Follow Google's [Sign in with Google setup guide](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).
3. Put the Web client **Client ID** in the root `.env` file:

   ```dotenv
   GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
   ```

   The Client ID is a public identifier. This integration does not use a client secret; do not put one in frontend code or a `VITE_*` variable.
4. Apply migrations and restart the API after setting the value:

   ```powershell
   npm --prefix server run migrate
   npm run agri:server
   ```

The `014_google_sign_in.sql` migration adds a unique `users.google_sub` column to link returning users by Google's stable account ID. On first sign-in, AgriSystem links a registered account only when its saved address matches a verified Gmail or Google Workspace address. Other registered email addresses can continue using password sign-in. Disabled accounts stay disabled, farmer registration status is preserved, and the role comes from the existing database record. Gmail/mobile number and password login remain available.

## Application areas

- Farmer: farm profile and land, crop-damage reports, notifications, and report history.
- MAO staff and technicians: report review and operations dashboards.
- LGU administrators: farmer registration review, user management, and system controls.

## AGriSystem Docker Setup

This is a separate local development stack. It uses its own MySQL database and never reads the production Railway connection values from the root .env file.

### Prerequisites

- Docker Desktop for Windows, running with the Linux container engine.
- Git and this AgriSystem project.

### Environment variables

The project already uses the root .env file for local development and deployment-related settings. Leave that file unchanged. For Docker, create a separate local settings file:

    Copy-Item .env.docker.example .env.docker

Edit .env.docker and replace the example passwords/secrets with new, local-only values. Add optional integration keys only to this file. Do not copy production database credentials into this file. The .env.docker file is ignored by Git and excluded from Docker build contexts.

### Build and start

Open PowerShell in the project root, then run:

    docker compose --env-file .env.docker up --build -d

The backend applies pending SQL migrations to the dedicated local database before starting. Existing Railway and Vercel deployments are not changed.

### Local URLs

- AgriSystem frontend: http://localhost:3001
- Backend health check: http://localhost:5001/health
- phpMyAdmin: http://localhost:8082

phpMyAdmin uses the local MySQL service. Sign in with the local database username/password in .env.docker. MySQL itself is available only inside the Docker network and has no published host port.

### Status, logs, and shutdown

    docker compose --env-file .env.docker ps
    docker compose --env-file .env.docker logs -f
    docker compose --env-file .env.docker down

The normal shutdown command preserves the local database and uploaded files. Do not add -v to down unless you intentionally want to delete the local Docker volumes and their data.

### Docker Desktop verification

In Docker Desktop, open Containers. The agrisystem project should show four services: agrisystem-frontend, agrisystem-backend, agrisystem-mysql, and agrisystem-phpmyadmin. MySQL must report healthy, then the backend and frontend should become healthy/running. Open the URLs above to verify the frontend, API health, and database manager.
