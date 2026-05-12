# Secure Chat System

This document describes the secure real-time doctor-patient chat added to the Pulse Oximeter web application.

## Overview

- Real-time transport: Socket.IO over the existing authenticated backend server
- Persistence: MongoDB via Mongoose
- Access control: only `active` `DoctorPatient` assignments can load messages, send messages, receive typing indicators, or receive presence updates
- UI targets: patient dashboard and doctor dashboard
- Security posture:
  - existing JWT/cookie auth is reused for both REST and sockets
  - REST write endpoints keep CSRF protection
  - all socket events re-check conversation membership server-side
  - messages are validated and trimmed before storage
  - unread counters are updated server-side, not trusted from the client

## Backend Architecture

### Data flow

1. A patient requests a doctor assignment through the existing assignment flow.
2. When the assignment becomes `active`, the backend creates or re-activates a `ChatConversation`.
3. The dashboard fetches `GET /api/chat/conversations`.
4. Message history loads through `GET /api/chat/conversations/:conversationId/messages`.
5. New messages are sent through Socket.IO when available, with REST fallback for resilience.
6. The server stores the message in MongoDB, updates unread counters on `ChatConversation`, and emits real-time updates to the patient and doctor user rooms.
7. Opening a conversation marks it read through `POST /api/chat/conversations/:conversationId/read`.

### Core backend files

```text
backend/src
├── config/socket.js
├── controllers/chatController.js
├── models/ChatConversation.js
├── models/ChatMessage.js
├── routes/chatRoutes.js
├── services/chatService.js
├── services/presenceService.js
└── validations/chatValidation.js
```

### Database schema

#### `ChatConversation`

- `assignment`: links the conversation to the unique `DoctorPatient` record
- `doctor`, `patient`: explicit participant references for fast authorization
- `status`: `active | archived`
- `lastMessage`: compact preview metadata for conversation lists
- `unreadCounts.patient`, `unreadCounts.doctor`
- `lastReadAt.patient`, `lastReadAt.doctor`
- `archivedAt`

Indexes:

- unique `assignment`
- `{ doctor, status, updatedAt }`
- `{ patient, status, updatedAt }`

#### `ChatMessage`

- `conversation`
- `assignment`
- `sender`, `senderRole`
- `recipient`, `recipientRole`
- `type`: currently `text`
- `body`
- `readAt`
- `createdAt`, `updatedAt`

Indexes:

- `{ conversation, createdAt, _id }`
- `{ recipient, readAt, createdAt }`

## Frontend Architecture

### Core frontend files

```text
frontend/src
├── api/chatApi.js
├── components/chat/ChatPanel.jsx
├── context/NotificationsContext.jsx
├── pages/DoctorDashboardPage.jsx
├── pages/PatientDashboardPage.jsx
└── styles/index.css
```

### UI behavior

- Shared `ChatPanel` component is embedded inside both dashboards
- Responsive two-pane layout:
  - conversation list on the left
  - active message thread on the right
  - stacks vertically on smaller screens
- Features included:
  - unread indicators
  - timestamps
  - online/offline presence
  - typing indicator
  - notification tray integration
  - browser popup notifications when permission is granted and the tab is hidden

## REST API

### `GET /api/chat/conversations`

Returns all active conversations available to the authenticated patient or doctor.

Response shape:

```json
{
  "conversations": [
    {
      "id": "665...",
      "assignmentId": "665...",
      "status": "active",
      "unreadCount": 2,
      "lastReadAt": "2026-05-12T10:20:00.000Z",
      "latestActivityAt": "2026-05-12T10:24:13.000Z",
      "participant": {
        "id": "665...",
        "name": "Dr. Samir Ali",
        "email": "samir@example.com",
        "role": "doctor",
        "specialty": "Pulmonology",
        "onlineStatus": {
          "isOnline": true,
          "onlineSince": "2026-05-12T10:10:00.000Z",
          "lastSeenAt": null
        }
      },
      "lastMessage": {
        "id": "665...",
        "bodyPreview": "Please keep your device connected tonight.",
        "senderId": "665...",
        "senderRole": "doctor",
        "sentAt": "2026-05-12T10:24:13.000Z",
        "type": "text"
      }
    }
  ]
}
```

### `GET /api/chat/conversations/:conversationId/messages?limit=30&before=<ISO_DATE>`

Returns paginated message history for one active conversation.

### `POST /api/chat/conversations/:conversationId/messages`

Body:

```json
{
  "body": "Hello doctor, my oxygen level dropped this morning."
}
```

### `POST /api/chat/conversations/:conversationId/read`

Marks the conversation as read for the authenticated user and clears the unread counter for that side.

## Socket Events

### Client to server

#### `chat:message:send`

Payload:

```json
{
  "conversationId": "665...",
  "body": "Can you review my latest readings?"
}
```

Ack:

```json
{
  "ok": true,
  "messageId": "665..."
}
```

#### `chat:typing:start`

```json
{
  "conversationId": "665..."
}
```

#### `chat:typing:stop`

```json
{
  "conversationId": "665..."
}
```

### Server to client

#### `chat:message:new`

Sent to both the sender and the recipient with a user-specific conversation summary plus the stored message.

#### `chat:conversation:updated`

Used to synchronize unread counters, archived status, and presence-aware conversation metadata.

#### `chat:conversation:read`

Sent to both chat participants when one side opens a conversation and unread messages are marked read.

```json
{
  "conversationId": "665...",
  "readerId": "665...",
  "readerRole": "patient",
  "participantId": "665...",
  "readAt": "2026-05-12T10:27:00.000Z"
}
```

#### `chat:presence:update`

Payload:

```json
{
  "userId": "665...",
  "role": "doctor",
  "isOnline": true,
  "onlineSince": "2026-05-12T10:10:00.000Z",
  "lastSeenAt": null,
  "updatedAt": "2026-05-12T10:10:03.000Z"
}
```

#### `chat:typing:update`

Payload:

```json
{
  "conversationId": "665...",
  "userId": "665...",
  "role": "patient",
  "name": "Nour Hassan",
  "isTyping": true,
  "updatedAt": "2026-05-12T10:25:00.000Z"
}
```

## Environment Variables

No new secret is required for basic chat. The feature relies on the existing application configuration:

### Backend

- `MONGODB_URI`
- `JWT_SECRET`
- `REFRESH_TOKEN_SECRET`
- `CORS_ORIGIN`
- `AUTH_COOKIE_NAME`
- `AUTH_COOKIE_SECURE`
- `CSRF_COOKIE_NAME`
- `CSRF_HEADER_NAME`

### Frontend

- `VITE_API_URL`
- `VITE_SOCKET_URL`
- `VITE_CSRF_COOKIE_NAME`
- `VITE_CSRF_HEADER_NAME`

## Setup Instructions

1. Install workspace dependencies with `npm install`.
2. Copy env templates if needed:
   - `cp backend/.env.example backend/.env`
   - `cp frontend/.env.example frontend/.env`
3. Start MongoDB and the app:
   - `npm run dev`
4. Create at least:
   - one verified patient
   - one verified and approved doctor
5. From the patient dashboard, request a doctor assignment.
6. From the doctor dashboard, approve the assignment.
7. Open the chat section in either dashboard and begin messaging.

## Testing Steps

### Functional

1. Sign in as a patient in one browser and as the assigned doctor in another.
2. Confirm both users see the same active conversation in the chat section.
3. Send a message from the patient and verify:
   - instant delivery on the doctor side
   - unread badge increments if the doctor is not focused on the thread
   - timestamp is rendered
   - notification appears in the tray
4. Start typing and verify the other side sees the typing indicator.
5. Close one browser tab and verify the participant becomes offline.
6. Reload both dashboards and confirm message history persists.
7. End the assignment and confirm the conversation disappears from active lists.

### Security

1. Attempt to open another conversation ID manually through the API with an unrelated account.
2. Attempt to send a socket message to a conversation not owned by the authenticated user.
3. Attempt to send markup-heavy or oversize content and verify validation blocks it.

## Future Improvements

- Add file and image attachments with antivirus scanning and size quotas
- Add call session metadata for future video consultations
- Replace in-memory presence with a shared Socket.IO adapter for multi-instance deployments
- Add delivery state metrics and audit trails
- Add archived conversation browsing for ended assignments if the product wants historical access
- Add end-to-end encryption only if operational workflows can still support moderation, audit, and recovery requirements
