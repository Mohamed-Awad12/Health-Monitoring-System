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

All chat REST endpoints are rooted at `/api/chat`.

### Access rules

- Authentication is required for every chat endpoint.
- Only users with the `patient` role or an approved `doctor` role can access chat routes.
- The authenticated user must belong to the target conversation.
- The underlying `DoctorPatient` assignment must still be `active`.
- Write endpoints are protected by the authenticated write rate limiter and the existing CSRF middleware.

### Common headers

For write endpoints, send the existing CSRF header used elsewhere in the app together with the authenticated session cookie or bearer token.

Examples:

```http
Cookie: pulse_session=<token>
x-csrf-token: <csrf-token>
```

### Shared response objects

#### `ConversationSummary`

```json
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
```

#### `ChatMessage`

```json
{
  "id": "665...",
  "conversationId": "665...",
  "assignmentId": "665...",
  "senderId": "665...",
  "senderRole": "patient",
  "recipientId": "665...",
  "recipientRole": "doctor",
  "body": "Hello doctor, my oxygen level dropped this morning.",
  "type": "text",
  "attachment": null,
  "createdAt": "2026-05-12T10:24:13.000Z",
  "updatedAt": "2026-05-12T10:24:13.000Z",
  "readAt": null,
  "isOwnMessage": true
}
```

#### `AttachmentMetadata`

```json
{
  "originalName": "oxygen-report.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 182441,
  "extension": ".pdf",
  "isAvailable": true,
  "urlPath": "/chat/conversations/665.../messages/665.../attachment",
  "downloadUrlPath": "/chat/conversations/665.../messages/665.../attachment?download=1"
}
```

### Endpoint reference

#### `GET /api/chat/conversations`

Returns every active chat conversation available to the authenticated patient or doctor.

Request:

- Query parameters: none
- Body: none

Success response: `200 OK`

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

Notes:

- The list is sorted by `latestActivityAt` descending.
- Conversations are created or re-activated automatically from active doctor-patient assignments.
- `unreadCount` and `lastReadAt` are always from the perspective of the current authenticated user.

#### `GET /api/chat/conversations/:conversationId/messages`

Returns paginated message history for one active conversation.

Path parameters:

- `conversationId`: MongoDB ObjectId of the chat conversation

Query parameters:

- `limit`: optional integer, default `30`, minimum `1`, maximum `100`
- `before`: optional ISO 8601 datetime with timezone offset; returns messages older than this timestamp

Example request:

```http
GET /api/chat/conversations/665.../messages?limit=30&before=2026-05-12T10:24:13.000Z
```

Success response: `200 OK`

```json
{
  "conversation": {
    "id": "665...",
    "assignmentId": "665...",
    "status": "active",
    "unreadCount": 0,
    "lastReadAt": "2026-05-12T10:27:00.000Z",
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
  },
  "messages": [
    {
      "id": "665...",
      "conversationId": "665...",
      "assignmentId": "665...",
      "senderId": "665...",
      "senderRole": "doctor",
      "recipientId": "665...",
      "recipientRole": "patient",
      "body": "Please keep your device connected tonight.",
      "type": "text",
      "attachment": null,
      "createdAt": "2026-05-12T10:24:13.000Z",
      "updatedAt": "2026-05-12T10:24:13.000Z",
      "readAt": "2026-05-12T10:27:00.000Z",
      "isOwnMessage": false
    }
  ],
  "pagination": {
    "hasMore": false,
    "nextCursor": null
  }
}
```

Notes:

- Messages are returned in ascending chronological order inside `messages`.
- Use `pagination.nextCursor` as the next `before` value when loading older pages.

#### `POST /api/chat/conversations/:conversationId/messages`

Creates a text message in the target conversation.

Path parameters:

- `conversationId`: MongoDB ObjectId of the chat conversation

Request headers:

- `Content-Type: application/json`
- CSRF header required

Request body:

```json
{
  "body": "Hello doctor, my oxygen level dropped this morning."
}
```

Validation rules:

- `body` is required
- `body` must be between `1` and `2000` characters after normalization
- line endings and repeated blank lines are normalized server-side
- HTML-like markup using `<` or `>` is rejected

Success response: `201 Created`

```json
{
  "message": "Chat message sent",
  "conversation": {
    "id": "665...",
    "assignmentId": "665...",
    "status": "active",
    "unreadCount": 0,
    "lastReadAt": "2026-05-12T10:24:13.000Z",
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
      "bodyPreview": "Hello doctor, my oxygen level dropped this morning.",
      "senderId": "665...",
      "senderRole": "patient",
      "sentAt": "2026-05-12T10:24:13.000Z",
      "type": "text"
    }
  },
  "chatMessage": {
    "id": "665...",
    "conversationId": "665...",
    "assignmentId": "665...",
    "senderId": "665...",
    "senderRole": "patient",
    "recipientId": "665...",
    "recipientRole": "doctor",
    "body": "Hello doctor, my oxygen level dropped this morning.",
    "type": "text",
    "attachment": null,
    "createdAt": "2026-05-12T10:24:13.000Z",
    "updatedAt": "2026-05-12T10:24:13.000Z",
    "readAt": null,
    "isOwnMessage": true
  }
}
```

#### `POST /api/chat/conversations/:conversationId/messages/attachment`

Creates an attachment message with an optional text caption.

Path parameters:

- `conversationId`: MongoDB ObjectId of the chat conversation

Request headers:

- `Content-Type: multipart/form-data`
- CSRF header required

Form fields:

- `attachment`: required file field
- `body`: optional caption string, up to `2000` characters after normalization

Attachment rules:

- Maximum size: `5 MB`
- Allowed MIME types:
  - images: `image/gif`, `image/jpeg`, `image/png`, `image/webp`
  - audio: `audio/aac`, `audio/m4a`, `audio/mp4`, `audio/mpeg`, `audio/ogg`, `audio/wav`, `audio/wave`, `audio/webm`, `audio/x-m4a`, `audio/x-wav`
  - documents: `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  - spreadsheets: `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - other supported files: `application/zip`, `text/csv`, `text/plain`

Success response: `201 Created`

```json
{
  "message": "Chat attachment sent",
  "conversation": {
    "id": "665...",
    "assignmentId": "665...",
    "status": "active",
    "unreadCount": 0,
    "lastReadAt": "2026-05-12T10:30:15.000Z",
    "latestActivityAt": "2026-05-12T10:30:15.000Z",
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
      "bodyPreview": "Image: pulse-reading.png",
      "senderId": "665...",
      "senderRole": "patient",
      "sentAt": "2026-05-12T10:30:15.000Z",
      "type": "image"
    }
  },
  "chatMessage": {
    "id": "665...",
    "conversationId": "665...",
    "assignmentId": "665...",
    "senderId": "665...",
    "senderRole": "patient",
    "recipientId": "665...",
    "recipientRole": "doctor",
    "body": "",
    "type": "image",
    "attachment": {
      "originalName": "pulse-reading.png",
      "mimeType": "image/png",
      "sizeBytes": 182441,
      "extension": ".png",
      "urlPath": "/chat/conversations/665.../messages/665.../attachment",
      "downloadUrlPath": "/chat/conversations/665.../messages/665.../attachment?download=1"
    },
    "createdAt": "2026-05-12T10:30:15.000Z",
    "updatedAt": "2026-05-12T10:30:15.000Z",
    "readAt": null,
    "isOwnMessage": true
  }
}
```

Notes:

- The server derives `type` from the uploaded file MIME type.
- Resulting message types are `image`, `audio`, or `file`.

#### `GET /api/chat/conversations/:conversationId/messages/:messageId/attachment`

Streams the stored attachment file for a message that belongs to the authenticated user.

Path parameters:

- `conversationId`: MongoDB ObjectId of the chat conversation
- `messageId`: MongoDB ObjectId of the message containing the attachment

Query parameters:

- `download`: optional boolean; accepts `1`, `true`, `yes`, or `on`

Behavior:

- Returns the raw binary file body
- Uses `Content-Disposition: inline` by default for images and audio
- Uses `Content-Disposition: attachment` for generic files, or whenever `download=1`
- Sets `Content-Type` from the stored attachment MIME type
- Sets `Content-Length` when the stored file size is available

Example request:

```http
GET /api/chat/conversations/665.../messages/665.../attachment?download=1
```

Success response: `200 OK`

- Response body is the attachment stream, not JSON.

#### `POST /api/chat/conversations/:conversationId/read`

Marks every unread message in the conversation as read for the authenticated user and clears that side's unread counter.

Path parameters:

- `conversationId`: MongoDB ObjectId of the chat conversation

Request:

- Body: none
- CSRF header required

Success response: `200 OK`

```json
{
  "message": "Conversation marked as read",
  "conversation": {
    "id": "665...",
    "assignmentId": "665...",
    "status": "active",
    "unreadCount": 0,
    "lastReadAt": "2026-05-12T10:27:00.000Z",
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
  },
  "readAt": "2026-05-12T10:27:00.000Z"
}
```

Notes:

- The backend also emits `chat:conversation:updated` and `chat:conversation:read` socket events after a successful read mark.

### Common error cases

Typical non-success responses include:

- `400 Bad Request`
  - invalid `conversationId` or `messageId`
  - invalid `limit` or malformed `before` datetime
  - empty or oversize text body
  - message body containing HTML-like markup
  - missing attachment file
  - unsupported attachment MIME type
- `401 Unauthorized`
  - missing or invalid authentication
- `403 Forbidden`
  - doctor account is not approved
  - conversation does not belong to the current user
  - conversation is archived or its doctor-patient assignment is no longer active
- `404 Not Found`
  - conversation does not exist
  - attachment does not exist or the stored file is unavailable

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
