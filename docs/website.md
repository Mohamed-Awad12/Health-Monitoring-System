# Website Documentation

Related document:

- [Mobile UI Guide](./mobile-ui-guide.md)

## Overview

This project ships a role-based web application for remote pulse oximeter monitoring.

- Patients can register, verify their email, link a pulse oximeter device, review live readings, manage doctor assignments, download reports, and generate an AI-assisted health summary.
- Doctors can register with a verification document, wait for admin approval, approve or deny patient assignment requests, and monitor assigned patients in real time.
- Admins can manage users, review doctor verification submissions, and resend verification emails.

The frontend is built with React and Vite. The backend is built with Express, MongoDB, and Socket.IO.

## Website Map

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Public | Redirects to `/login` |
| `/login` | Public | Sign in |
| `/register` | Public | Register as patient or doctor |
| `/verify-email` | Public | Submit the 6-digit email verification OTP |
| `/forgot-password` | Public | Request a password reset OTP |
| `/reset-password` | Public | Reset password with OTP |
| `/patient` | Patient only | Patient dashboard |
| `/doctor` | Approved doctor only | Doctor dashboard |
| `/admin` | Admin only | Admin dashboard |

Implementation note: [frontend/src/pages/LandingPage.jsx](../frontend/src/pages/LandingPage.jsx) exists, but [frontend/src/App.jsx](../frontend/src/App.jsx) currently sends `/` to `/login`, so the landing page is not mounted in the active route tree.

## Role Flows

### Patient flow

1. Register from `/register` as a patient.
2. Verify the account with the OTP sent by email.
3. Log in and open `/patient`.
4. Link a device using `deviceSecretId`.
5. Review live SpO2 and BPM cards, charts, and alerts.
6. Search for doctors by name prefix and send an assignment request.
7. Download CSV or PDF reports, or generate an AI assistant report.

### Doctor flow

1. Register from `/register` as a doctor.
2. Upload a verification document during signup.
3. Verify the email with OTP.
4. Wait for an admin to approve the doctor verification request.
5. Log in to `/doctor`.
6. Approve or deny patient assignment requests.
7. Monitor assigned patients, readings, and alerts in real time.

### Admin flow

1. Create the first admin through the bootstrap API if no admin exists yet.
2. Log in to `/admin`.
3. Create, edit, or delete users.
4. Review doctor verification documents.
5. Approve or reject doctor verification requests.
6. Resend verification emails for users who have not verified their email.

## Real-Time Data Flow

1. A device sends a reading to `POST /api/device/data`.
2. The backend stores the reading in MongoDB.
3. Alert rules evaluate the reading against configured thresholds.
4. Any new alerts are deduplicated for 5 minutes per alert type.
5. Socket.IO emits `reading:new` and `alert:new` events to the patient and assigned doctors.
6. Patient and doctor dashboards refresh automatically when socket events arrive.

Alert thresholds are configured with:

- `PATIENT_LOW_SPO2_THRESHOLD`
- `PATIENT_LOW_BPM_THRESHOLD`
- `PATIENT_HIGH_BPM_THRESHOLD`

## Local Development

### Requirements

- Node.js and `npm`
- MongoDB, or Docker if you want the helper script to auto-start a local MongoDB container

### Start the app

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create env files:

   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

3. Set the minimum backend variables in `backend/.env`:

   - `MONGODB_URI`
   - `JWT_SECRET`

4. Start both services:

   ```bash
   npm run dev
   ```

   Or use the helper:

   ```bash
   npm run run:project
   ```

   The helper script can auto-start MongoDB with Docker when `MONGODB_URI` points to local MongoDB on port `27017`.

5. Open:

   - `http://localhost:5173` on the same machine
   - `http://<your-host-ip>:5173` from another device on the same network

### Frontend host resolution

If `VITE_API_URL` and `VITE_SOCKET_URL` are left empty, the frontend resolves them from the current browser hostname and uses port `5000`. This makes local LAN testing easier when the frontend is opened from another device.

## First Admin Bootstrap

The admin dashboard is protected and there is no public admin registration screen. To create the first admin, set `ADMIN_BOOTSTRAP_TOKEN` in `backend/.env`, then call the bootstrap route.

Example:

```bash
curl -X POST http://localhost:5000/api/auth/register/admin/bootstrap \
  -H "Content-Type: application/json" \
  -H "x-admin-bootstrap-token: change-this-to-a-long-secret" \
  -d '{
    "name": "System Admin",
    "email": "admin@example.com",
    "password": "StrongPassword123",
    "phone": "+201000000000"
  }'
```

Notes:

- The route is disabled unless `ADMIN_BOOTSTRAP_TOKEN` is set.
- The bootstrap route only works if no admin user already exists.

## Device Payload Example

```json
{
  "deviceSecretId": "PULSE-DEVICE-001",
  "spo2": 97,
  "bpm": 74,
  "timestamp": "2026-04-15T09:40:00.000Z"
}
```

## Reports And Assistant Output

- `GET /api/patients/reports?range=<range>&format=csv` returns a CSV export.
- `GET /api/patients/reports?range=<range>&format=pdf` returns a styled PDF summary.
- `POST /api/patients/assistant/report` returns a bilingual English/Arabic assistant summary.

If `AI_HEALTH_ASSISTANT_API_KEY` is not configured, the assistant falls back to a built-in safe summary instead of failing.

## Email Behavior

- Email verification uses a 6-digit OTP.
- Password reset uses a 6-digit OTP.
- Doctor approval is separate from email verification.
- If SMTP is not configured, the backend simulates email delivery and prints the message content to the backend logs.

`EMAIL_VERIFICATION_URL` exists in the backend env schema, but the current implementation sends OTP emails rather than a clickable verification link.

## Key Files

- [frontend/src/App.jsx](../frontend/src/App.jsx): frontend routes and protected route wiring
- [frontend/src/context/AuthContext.jsx](../frontend/src/context/AuthContext.jsx): JWT session management
- [frontend/src/context/SocketContext.jsx](../frontend/src/context/SocketContext.jsx): authenticated Socket.IO client
- [frontend/src/context/UiPreferencesContext.jsx](../frontend/src/context/UiPreferencesContext.jsx): theme, language, RTL/LTR, number/date formatting
- [frontend/src/pages](../frontend/src/pages): page-level UI for auth and dashboards
- [backend/src/app.js](../backend/src/app.js): Express middleware and API route mounting
- [backend/src/controllers](../backend/src/controllers): request handling for auth, patient, doctor, admin, and device flows
- [backend/src/services/alertService.js](../backend/src/services/alertService.js): alert threshold evaluation and dedupe
- [backend/src/services/reportService.js](../backend/src/services/reportService.js): CSV and PDF report generation
- [backend/src/services/healthAssistantService.js](../backend/src/services/healthAssistantService.js): AI summary generation and fallback behavior

## Storage Notes

The frontend stores these values in `localStorage`:

- `pulse_token`
- `pulse_user`
- `pulse_theme`
- `pulse_locale`
