# Hit-IT API Documentation

This document provides a comprehensive reference for all features, API endpoints, and system behaviors in the Hit-IT frontend.

---

## 🛠️ Global Rules & Headers

All authenticated requests are handled by the `apiClient` in `src/api.jsx`.

### Scoping Headers
Depending on the active workspace (Personal, Team, or Org), the following headers are automatically attached:

| Header      | Condition / Rule                                         |
| :---------- | :------------------------------------------------------- |
| `X-Org-Id`  | Sent if an organization is active or explicitly provided.|
| `X-Team-Id` | Sent if a team is active or explicitly provided.         |
| `Authorization` | `Bearer <token>` sent if `auth: true` is requested.  |

> [!NOTE]
> **Automatic Scoping**: The `apiClient` automatically retrieves the active Organization ID from `localStorage.getItem('hitit_active_org')` if not explicitly passed, ensuring workspace consistency across all sessions.

-------------------------------------------------------------------------

## 🔐 Authentication (`auth.api.jsx`)

### 1. Sign In / Sign Up
- **Paths**: `POST /api/auth/sign-in`, `POST /api/auth/sign-up`
- **Objective**: Authenticate user and obtain a JWT.
- **Post-Success**: Token is stored in `localStorage` via `tokenStore`. UI refreshes session state.

### 2. Get Me
- **Path**: `GET /api/auth/me`
- **Objective**: Retrieve current user details to verify session on mount.

---

## 👥 Teams & Organization (`teams.api.jsx` & `orgs.api.jsx`)

### 1. Workspace Scoping
- **Get My Teams**: `GET /api/teams` (Scoped by `X-Org-Id` if in Org Mode).
- **Organization Details**: `GET /api/organizations/details/:id`.
- **Verify Organization**: `POST /api/organizations/verify/:id`.

### 2. Team Management
- **Invite**: `POST /api/teams/:id/invite` (Multi-email).
- **Join**: `POST /api/join-team/:token`.
- **Ownership**: `POST /api/teams/:id/transfer-ownership`.

### 3. Team Activity Feed (`TeamActivityFeed.jsx`)
Real-time sidebar for team-wide communication and issue tracking.
- **GET /api/teams/:id/feed**: Fetch message history.
- **POST /api/teams/:id/feed/send**: Send message or "Issue".
  - **Payload**: `{ type: "message"|"issue", message, title?, mentions: [userIds] }`
- **PATCH /api/teams/:id/feed/:feedId/resolve**: Mark an issue as resolved.

---

## 📂 Collections & Personalization (`homePage.api.jsx` & `NewCollectionModal.jsx`)

### 1. Get Collections
- **Path**: `GET /api/collections`
- **Variants**: Supports `filter=fav`, `filter=share`, `filter=mine`.
- **Test Suite Scope**: Append `?testSuit=true` to retrieve only Test Suite collections.

### 2. Visual Customization
- **Accent Colors**: 8 curated palettes (Purple, Blue, Green, etc.).
- **Patterns**: `waves`, `grid`, `dots`, `lines`, `cross`.
- **Default Method**: Presets the initial method for requests in the collection.

### 3. Import Logic
- **Path**: `POST /api/collaborators/import`
- **Objective**: Import collection/access via shared `id_string`.

---

## 🚀 Requests (`request.api.jsx`)

### 1. Hit Request (Execute)
- **Path**: `POST /api/requests/:id/hit`
- **Objective**: Backend execution of the HTTP request.
- **Response**: Returns `status_code`, `response_time_ms`, `body`, and `headers`.

### 2. CURL Logic
- **Parsing**: `CollectionModal.jsx` includes a complex parser to convert raw cURL strings into Hit-IT request objects.
- **Generation**: Can generate cURL commands from existing request state.

---

## 🌍 Global Variables & Environments (`GlobalStore.jsx`)

Hit-IT supports dynamic variable injection using the `{{key}}` syntax.

### 1. Environments
- **Development** (#10b981), **Staging** (#f59e0b), **Production** (#ef4444).

### 2. Variable Categories
- **Auth**, **API**, **Infra**, **Secrets**.

### 3. Logic & Rules
- **Injection**: Strings like `{{base_url}}/users` are resolved at execution time.
- **Overrides**: Collections can define specific overrides for global variables.

---

## 🕒 History & Logs (`history.api.jsx`)

### 1. Get History
- **Path**: `GET /api/history`
- **Objective**: Retrieve execution logs scoped by Team/Org headers.

---

## 🤖 Activity & Real-time Feed (`activity_feed.api.jsx` & WS)

### 1. Feed WebSocket
- **URL**: `ws://localhost:8080/api/v1/ws/:collectionId?token=...`
- **Objective**: Real-time chats and AI responses within a collection.

### 2. Query AI Assistant
- **Path**: `POST /api/feed/ai/query`
- **Objective**: Contextual AI interaction using collection/request data as prompt context.

---

## 🧪 Test Suite & Automated Testing (`testSuite.api.js`)

The Test Suite allows for regression testing by comparing current responses against saved expectations.

### 1. Execute Test Run (Async Job)
- **Path**: `POST /api/test-suite/jobs`
- **Payload**: `{ "collections": ["c1"], "requests": ["r1", "r2"] }`
- **Objective**: Generates tracking records and kicks off async execution. If any request lacks `expected_response`, returns `400`.
- **Response**: `{ "success": true, "data": { "job_id": "uuid-123" } }`

### 2. Poll Job Status
- **Path**: `GET /api/test-suite/jobs/:id/status`
- **Objective**: Checks async progress.
- **Response**: `{ "status": "processing", "successful": 4, "failed": 0 }`

### 3. Fetch Job Results
- **Path**: `GET /api/test-suite/jobs/:id/results`
- **Objective**: Get final arrays of IDs to paint the UI red/green.
- **Response**: `{ "passed_ids": ["r1"], "failed_ids": ["r2"] }`

### 4. Fetch Details & Diff
- **Path**: `GET /api/test-suite/requests/:id/details`
- **Objective**: Fetch expected JSON vs the actual saved `history` payload for a visual diff.

### 5. Manage Expectations
- **Path**: `PATCH /api/test-suite/requests/:id/expected`
- **Payload**: `{ "expected_response": "{ \"status\": \"ok\" }" }`
- **Objective**: Update the "Source of Truth". Must be set before a request can be run.

### 4. Collection & Request Management
- **Rule**: All standard CRUD operations on `/api/collections` and `/api/requests` must include `?testSuit=true` (or `{ "testSuit": true }` in POST/PATCH bodies) to isolate these assets from the main operational workspace.

---

## 💾 Application State & Persistence

| Key | Purpose |
| :--- | :--- |
| `hitit_token` | JWT Storage. |
| `hitit_req_draft_{id}` | Auto-saved request edits (URL, Body, etc.). |
| `hitit_last_org` | Persists active Org ID between sessions. |
| `hitit_theme` | Stores color preference (Dark/Light). |

---

## ⚠️ Error Handling (`api.jsx`)

All failures throw a structured `ApiError`.
- **Success Response**: `{ "success": true, "data": { ... } }`
- **Error Response**: `{ "success": false, "error": { "message": "...", "status": 401 } }`
