# Mobile UI Guide

## Purpose

This document explains the current web UI so it can be rebuilt as a mobile app without losing the product structure, visual language, or interaction patterns.

Primary source files:

- [frontend/src/App.jsx](../frontend/src/App.jsx)
- [frontend/src/styles/index.css](../frontend/src/styles/index.css)
- [frontend/src/styles/auth-neo.css](../frontend/src/styles/auth-neo.css)
- [frontend/src/components/layout/AppShell.jsx](../frontend/src/components/layout/AppShell.jsx)
- [frontend/src/pages](../frontend/src/pages)

## Product Areas

The web app has four UI groups:

1. Auth screens
2. Patient dashboard
3. Doctor dashboard
4. Admin dashboard

There is also a richer marketing landing page in [frontend/src/pages/LandingPage.jsx](../frontend/src/pages/LandingPage.jsx), but it is not mounted in the active route tree. Treat it as optional inspiration, not a required mobile screen.

## Active Screens

| Route | Screen | Notes |
| --- | --- | --- |
| `/login` | Login | Email + password |
| `/register` | Register | Role switch between patient and doctor |
| `/verify-email` | Verify email | 6-digit OTP flow |
| `/forgot-password` | Forgot password | Request reset OTP |
| `/reset-password` | Reset password | OTP reset flow, or token reset flow |
| `/patient` | Patient dashboard | Main end-user monitoring view |
| `/doctor` | Doctor dashboard | Review requests and monitor assigned patients |
| `/admin` | Admin dashboard | Internal management UI |

## Visual Language

### Theme

- Default theme is dark.
- Light theme exists and should be kept in mobile.
- Theme is user-controlled through the shared preference control.
- English and Arabic are both supported.
- Arabic switches the document to RTL, so the mobile app must support mirrored layout.

### Typography

- Primary UI font: `Sora`
- Numeric/technical emphasis font: `JetBrains Mono`
- Use `JetBrains Mono` for large metric values, brand badges, and compact telemetry labels.

### Core Tokens

Dark theme values from [frontend/src/styles/index.css](../frontend/src/styles/index.css):

| Token | Value | Usage |
| --- | --- | --- |
| `--bg` | `#060b14` | App background |
| `--bg-soft` | `#0b1322` | Inner surfaces / inputs |
| `--surface` | `rgba(17, 28, 45, 0.76)` | Main glass cards |
| `--surface-strong` | `rgba(24, 38, 59, 0.88)` | Stronger elevated panels |
| `--text` | `#dbe8ff` | Default text |
| `--text-strong` | `#f6faff` | Headings / metric emphasis |
| `--muted` | `#8ea5c2` | Secondary text |
| `--primary` | `#47c8ff` | Main blue accent |
| `--accent` | `#2de3b5` | Positive / healthy accent |
| `--accent-2` | `#1aa8ff` | Secondary bright blue accent |
| `--critical` | `#ff7089` | Critical / destructive |
| `--warning` | `#ffc978` | Warning / pending |
| `--radius-lg` | `22px` | Primary card radius |
| `--radius-md` | `15px` | Input / inner card radius |

### Surface Style

The UI is not flat. It uses:

- Gradient-backed glass cards
- Soft borders instead of heavy dividers
- Blur and saturation on elevated surfaces
- Ambient radial glows in the page background
- High-contrast bright metric text on deep blue surfaces

For mobile, preserve that layered clinical-tech look. Do not replace it with plain white cards or default material panels.

### Motion

Motion is subtle but frequent:

- Page fade/slide transitions
- Hover lift on cards and buttons
- Metric value pulse on update
- Sticky top bar with moving highlight sweep
- Scroll reveal for cards
- Floating ambient background motion

For mobile, keep:

- Screen fade/slide transitions
- Metric refresh pulse
- Card entrance animation
- Reduced-motion fallback

You can drop desktop-only hover effects.

## Status System

Status is a core part of the UI language and must stay visually consistent.

| Status | Meaning | Color family |
| --- | --- | --- |
| `normal` | Reading is safe / acknowledged | Green-teal |
| `active` | Approved / active relationship | Green-teal |
| `warning` | Attention needed / no data | Amber |
| `pending` | Waiting for approval | Amber |
| `ended` | Closed state | Amber |
| `critical` | Health risk / urgent state | Pink-red |
| `denied` | Rejected relationship | Pink-red |

Rendered everywhere through [frontend/src/components/ui/StatusPill.jsx](../frontend/src/components/ui/StatusPill.jsx).

## Shared Components To Mirror

| Web component | Source | Mobile equivalent |
| --- | --- | --- |
| `AppShell` | [frontend/src/components/layout/AppShell.jsx](../frontend/src/components/layout/AppShell.jsx) | Sticky app bar + scrollable content |
| `SectionCard` | [frontend/src/components/ui/SectionCard.jsx](../frontend/src/components/ui/SectionCard.jsx) | Reusable panel / section container |
| `MetricCard` | [frontend/src/components/ui/MetricCard.jsx](../frontend/src/components/ui/MetricCard.jsx) | Telemetry stat tile |
| `StatusPill` | [frontend/src/components/ui/StatusPill.jsx](../frontend/src/components/ui/StatusPill.jsx) | Capsule badge |
| `RangeTabs` | [frontend/src/components/ui/RangeTabs.jsx](../frontend/src/components/ui/RangeTabs.jsx) | Segmented control: Day / Week / Month |
| `AlertList` | [frontend/src/components/ui/AlertList.jsx](../frontend/src/components/ui/AlertList.jsx) | Timeline-style alert feed |
| `EmptyState` | [frontend/src/components/ui/EmptyState.jsx](../frontend/src/components/ui/EmptyState.jsx) | Friendly empty placeholder |
| `VitalChart` | [frontend/src/components/charts/VitalChart.jsx](../frontend/src/components/charts/VitalChart.jsx) | Dual-line chart for SpO2 and BPM |
| `PreferenceControls` | [frontend/src/components/common/PreferenceControls.jsx](../frontend/src/components/common/PreferenceControls.jsx) | Theme/language toggle in profile sheet or settings |

## Auth UI

Source pages:

- [frontend/src/pages/LoginPage.jsx](../frontend/src/pages/LoginPage.jsx)
- [frontend/src/pages/RegisterPage.jsx](../frontend/src/pages/RegisterPage.jsx)
- [frontend/src/pages/VerifyEmailPage.jsx](../frontend/src/pages/VerifyEmailPage.jsx)
- [frontend/src/pages/ForgotPasswordPage.jsx](../frontend/src/pages/ForgotPasswordPage.jsx)
- [frontend/src/pages/ResetPasswordPage.jsx](../frontend/src/pages/ResetPasswordPage.jsx)

Source styling:

- [frontend/src/styles/auth-neo.css](../frontend/src/styles/auth-neo.css)

### Common Auth Layout

All auth screens use the same structure:

- Centered glass card
- Small Pulse brand mark at top
- Single-column form
- Success/error banners above the form
- Floating theme/language control

### Login

Contents:

- Brand chip
- Heading
- Email field
- Password field
- Primary submit button
- Forgot password link
- Footer link to register

### Register

Contents:

- Patient/Doctor role toggle
- Shared fields: name, email, phone, password, confirm password
- Doctor-only fields: specialty and verification document upload
- Large dashed upload card for verification file

Important mobile note:

- Doctor registration is visually heavier than patient registration. On mobile, use a progressive layout:
  - Step 1: choose role
  - Step 2: account details
  - Step 3: doctor verification upload, only for doctors

### Verify Email

Contents:

- Email field
- 6-digit OTP field
- Verify button
- Resend OTP button

### Forgot Password

Contents:

- Email field
- Send OTP button

### Reset Password

Contents:

- Email field, when using OTP flow
- OTP field, when using OTP flow
- New password
- Confirm password
- Reset button
- Resend OTP button for OTP flow

## Patient Dashboard

Source page:

- [frontend/src/pages/PatientDashboardPage.jsx](../frontend/src/pages/PatientDashboardPage.jsx)

### Web Structure

Desktop layout is two columns:

- Main column:
  - Vital overview
  - Alerts timeline
- Sidebar:
  - Connected device
  - Care team status
  - Doctor directory
  - Report export
  - AI assistant

### Vital Overview

This is the main patient screen and should remain the first mobile screen.

Contents:

- Section title
- `RangeTabs`: Day / Week / Month
- Snapshot status row with 3 cards:
  - Approved doctor
  - Pending request
  - Current device state
- 4 metric cards:
  - SpO2
  - BPM
  - Open alerts count
  - Samples count
- Dual-line chart:
  - SpO2 line
  - BPM line
  - Reference line at SpO2 `90`

### Alerts Timeline

Contents:

- Alert cards in a vertical timeline
- Each card shows:
  - Alert message
  - Status pill
  - SpO2/BPM values
  - Timestamp
  - Acknowledge action when unresolved

### Connected Device

Contents:

- Current linked device summary
  - Label
  - Status
  - Last seen
- Link device form
  - Device secret ID
  - Device label
  - Link button

### Care Team Status

Contents:

- Active doctor cards
- Pending doctor cards
- Last denied doctor card, when relevant

Each card shows:

- Doctor name
- Specialty
- Email
- Relationship status
- Time label such as requested/approved/denied

### Request A Doctor

Contents:

- Search input by doctor-name prefix
- Idle placeholder before typing
- Doctor result cards
- Primary action: request/approved/pending/request again
- Secondary danger action: cancel request or unassign
- Footer count with load-more button

### Report Export

Contents:

- CSV export button
- PDF export button

### AI Assistant

Contents:

- Generate summary button
- Error state if there is no usable reading
- Generated report card with:
  - Generation date
  - Condition
  - Concerns list
  - Advice list
  - Disclaimer
  - Fallback note if AI is unavailable

### Recommended Mobile Order

For a phone app, keep the same content but change the order:

1. Header summary
2. Range selector
3. Snapshot status cards
4. Metric cards
5. Vital chart
6. Alerts timeline
7. Connected device
8. Care team status
9. Doctor directory
10. Report export
11. AI assistant

## Doctor Dashboard

Source page:

- [frontend/src/pages/DoctorDashboardPage.jsx](../frontend/src/pages/DoctorDashboardPage.jsx)

### Web Structure

Desktop layout is also two columns:

- Left column:
  - Pending assignment requests
  - Assigned patients list
- Right column:
  - Selected patient overview
  - Patient alerts

### Pending Requests

Each request card includes:

- Patient name
- Email
- Pending badge
- Requested timestamp
- Latest vital values
- Approve button
- Deny button

### Assigned Patients

Each patient row includes:

- Name
- Email
- Latest metrics or no-readings label
- Status pill

The selected patient row is visually highlighted.

### Selected Patient Overview

Contents:

- Range selector
- 4 metric cards:
  - Current oxygen
  - Current heart rate
  - Open alerts
  - Samples
- Same vital chart used in patient dashboard

### Patient Alerts

Uses the same `AlertList` pattern as patient view.

### Recommended Mobile Pattern

Recommended navigation:

- Primary tabs: `Requests`, `Patients`, `Alerts`, `Profile`
- Inside `Patients`, open the selected patient into a detail screen with:
  - Header
  - Metrics
  - Chart
  - Alerts feed

This is the cleanest mobile equivalent of the split desktop layout.

## Admin Dashboard

Source page:

- [frontend/src/pages/AdminDashboardPage.jsx](../frontend/src/pages/AdminDashboardPage.jsx)

### Web Structure

Desktop layout:

- Left column:
  - User create/edit form
  - Filters
- Right column:
  - Overview metrics
  - Scrollable user cards

### User Form

Fields:

- Name
- Email
- Role
- Phone
- Specialty for doctor
- Password
- Email verified checkbox

Actions:

- Create user or update user
- Cancel edit

### Filters

Fields:

- Search users
- Role filter
- Doctor verification filter
- Clear filters button

### Overview Metrics

4 cards:

- Total users
- Total admins
- Total doctors
- Total patients

### User Cards

Each card includes:

- Name
- Email
- Role badge
- Verification info
- Phone
- Specialty for doctor
- Doctor verification state
- Created and updated dates
- Actions:
  - Send verification email
  - View doctor document
  - Approve doctor verification
  - Reject doctor verification
  - Edit
  - Delete

### Recommended Mobile Pattern

Do not keep the desktop split-screen admin layout on phone.

Use:

1. Overview screen with filters and user list
2. Separate create/edit user screen
3. Separate doctor verification detail screen if document review is needed

## Mobile Layout Rules

These rules preserve the current UI while making it usable on phones.

### App Bar

Web uses a sticky top bar with:

- Brand badge
- Screen title
- Subtitle
- Optional summary chips
- Preference controls
- Profile chip
- Sign-out button

Mobile equivalent:

- Compact sticky app bar
- Title + short subtitle only when necessary
- Overflow menu or profile sheet for:
  - Theme switch
  - Language switch
  - Sign out

### Cards And Grids

Web rules:

- 4-column metric grid on large screens
- 2-column metric grid on medium screens
- 1-column on small screens

Mobile recommendation:

- Use 2 columns for metrics on most phones
- Drop to 1 column only for very narrow widths or accessibility text scaling
- Keep snapshot status cards as either:
  - horizontal carousel, or
  - stacked cards

### Lists

Scrollable desktop side lists should become normal full-page lists on mobile:

- Doctor directory
- Assigned patients
- Admin users

### Forms

Desktop keeps long forms inline inside cards. On mobile:

- Use grouped field sections
- Push destructive actions lower
- Keep primary CTA sticky when forms are long

### Chart

The chart should stay full width and remain one of the first items on patient and doctor detail screens.

## Data And Interaction Rules

These behaviors are part of the UI and should not be dropped in mobile.

- Real-time refresh on new readings and alerts
- Day / Week / Month filtering
- Empty, loading, success, and error states for every section
- Role-based navigation
- English and Arabic copy
- RTL layout for Arabic
- Acknowledge alert actions
- Doctor request / approve / deny / unassign actions
- Report export actions
- AI assistant summary rendering

Relevant implementation references:

- [frontend/src/context/UiPreferencesContext.jsx](../frontend/src/context/UiPreferencesContext.jsx)
- [frontend/src/context/AuthContext.jsx](../frontend/src/context/AuthContext.jsx)
- [frontend/src/context/SocketContext.jsx](../frontend/src/context/SocketContext.jsx)

## Recommended Mobile Navigation

This is a recommendation, not a current web implementation.

### Patient

- `Home`
- `Alerts`
- `Care Team`
- `Profile`

### Doctor

- `Requests`
- `Patients`
- `Alerts`
- `Profile`

### Admin

- `Users`
- `Approvals`
- `Settings`

## Build Checklist

Use this checklist if the mobile app is intended to match the web UI closely.

- Match dark and light themes
- Support English and Arabic with RTL
- Reuse the same status color logic
- Keep glass panels, gradients, rounded corners, and bright telemetry accents
- Rebuild all auth flows including OTP resend
- Preserve patient chart + metrics + alert timeline as the core patient home screen
- Preserve doctor request review and selected-patient monitoring
- Preserve admin verification and user-management workflows if admin is part of scope
- Keep loading, empty, success, and error states visible instead of hidden
- Keep reduced-motion support

## Short Summary

If the mobile app should feel like the current web app, the non-negotiable pieces are:

- dark clinical-tech visual style
- bilingual EN/AR support with RTL
- status-driven metric cards
- chart-first patient monitoring
- card-based alert timeline
- role-specific flows for patient, doctor, and admin

The biggest adaptation is layout, not style. The desktop app relies on two-column dashboards, while mobile should turn those same sections into ordered vertical screens and tab-based navigation.
