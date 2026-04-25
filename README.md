# Smart Pulse Oximeter Platform

Production-oriented full-stack health monitoring platform for IoT-enabled pulse oximeter devices. The system ingests secure device readings, stores time-series measurements in MongoDB, supports patient and doctor portals, and streams real-time updates over WebSockets.

Website-specific documentation lives in [docs/website.md](docs/website.md).

Recent enhancements:

- Doctor assignment now uses a request workflow that doctors can approve or deny.
- Frontend supports English and Arabic with automatic `ltr`/`rtl` switching.
- Light and dark themes are available from the UI.
- Dashboards and auth screens have a refreshed visual design.

## Tech Stack

- Backend: Node.js, Express, MongoDB, Mongoose, JWT, Socket.IO
- Frontend: React, Vite, React Router, Context API, Axios, Recharts
- Security: Helmet, rate limiting, bcrypt password hashing, input validation with Zod, MongoDB operator sanitization

## Project Structure

```text
.
├── backend
│   ├── package.json
│   ├── .env.example
│   └── src
│       ├── app.js
│       ├── server.js
│       ├── config
│       ├── constants
│       ├── controllers
│       ├── middlewares
│       ├── models
│       ├── routes
│       ├── services
│       ├── utils
│       └── validations
├── frontend
│   ├── package.json
│   ├── .env.example
│   ├── index.html
│   └── src
│       ├── api
│       ├── components
│       ├── context
│       ├── hooks
│       ├── pages
│       ├── styles
│       ├── App.jsx
│       └── main.jsx
├── package.json
└── README.md
```

## API Summary

### Auth

- `POST /api/auth/register/patient`
- `POST /api/auth/register/doctor`
- `POST /api/auth/login`
- `POST /api/auth/verify-email`
- `POST /api/auth/verify-email/resend`
- `GET /api/auth/me`

### Device Ingestion

- `POST /api/device/data`

### Patient

- `PATCH /api/patients/device/link`
- `GET /api/patients/doctors?search=&page=&limit=` (returns empty list when `search` is blank; matches doctor name prefix)
- `POST /api/patients/doctor-assignment`
- `PATCH /api/patients/doctor-assignment/:assignmentId/unassign`
- `GET /api/patients/dashboard`
- `GET /api/patients/readings`
- `GET /api/patients/alerts`
- `PATCH /api/patients/alerts/:alertId/acknowledge`
- `GET /api/patients/reports`
- `POST /api/patients/assistant/report`

### Doctor

- `GET /api/doctors/patients`
- `PATCH /api/doctors/assignments/:assignmentId/approve`
- `PATCH /api/doctors/assignments/:assignmentId/deny`
- `GET /api/doctors/patients/:patientId/dashboard`
- `GET /api/doctors/patients/:patientId/readings`
- `GET /api/doctors/patients/:patientId/alerts`
- `PATCH /api/doctors/alerts/:alertId/acknowledge`

## Environment Variables

### Backend

See [backend/.env.example](/mnt/52FE347AFE345885/Pulse%20Oximeter/backend/.env.example).

Email alerting setup:

- Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS` to enable outgoing email.
- Optional `EMAIL_FROM` controls sender identity.
- `EMAIL_ALERTS_ENABLED=true` enables verification and medical alert emails.
- Email verification and password reset currently use emailed OTP codes.
- `PASSWORD_RESET_OTP_TTL_MINUTES` controls password reset OTP expiry.
- `EMAIL_VERIFICATION_URL` exists in config but is not used by the current OTP-based email flow.
- Alerts are sent only to verified emails (patient and active assigned doctors).

Admin bootstrap:

- Set `ADMIN_BOOTSTRAP_TOKEN` to enable `POST /api/auth/register/admin/bootstrap` for first-admin creation.

AI assistant setup:

- Set `AI_HEALTH_ASSISTANT_API_KEY` to enable live AI-generated summaries.
- If this key is missing or the provider is unavailable, the app falls back to built-in safe guidance.

### Frontend

See [frontend/.env.example](/mnt/52FE347AFE345885/Pulse%20Oximeter/frontend/.env.example).

## Run Locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment files:

   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

3. Configure MongoDB:

   - For hosted MongoDB, set `MONGODB_URI` in `backend/.env`.
   - For local MongoDB (`localhost:27017` or `127.0.0.1:27017`), you can let the helper script auto-start MongoDB using Docker.

4. Run the app:

   ```bash
   npm run dev
   ```

   Or run the helper script:

   ```bash
   npm run run:project
   ```

   The helper script checks env files and auto-starts MongoDB with Docker when `MONGODB_URI` points to local MongoDB and port `27017` is not already running.
   Backend binds to `0.0.0.0` by default, and auto-started MongoDB is published on `0.0.0.0:27017` for LAN access.

5. Open `http://localhost:5173`.

   To open from another device on your network, use `http://<your-host-ip>:5173`.

## Device Payload Example

```json
{
  "deviceSecretId": "PULSE-DEVICE-001",
  "spo2": 97,
  "bpm": 74,
  "timestamp": "2026-04-15T09:40:00.000Z"
}
```

## Deployment Notes

- Put the backend behind HTTPS or a TLS-terminating reverse proxy.
- Use a strong `JWT_SECRET`.
- Restrict `CORS_ORIGIN` to the deployed frontend origin.
- Consider secret rotation for device credentials in production.
# Health-Monitoring-System
