# UISurf App

UISurf is a full-stack operator workspace for authenticated chat sessions, prompt refinement, and remote UI automation. The repository combines a FastAPI backend with a Next.js frontend and uses Firebase authentication end to end.

## What It Includes

- FastAPI API in `src/uisurf_app`
- Next.js 15 frontend in `ui/`
- Firebase Auth on the client plus NextAuth on the server
- Chat session management backed by Google ADK session storage
- WebSocket-based live agent channel for UI automation workflows
- Optional remote UI-agent session provisioning for VNC/browser viewing

## Repository Layout

```text
src/uisurf_app/
  api/
  core/
  legacy/
  models/
  schemas/
  services/
  utils/
  main.py
ui/
  app/
  components/
  hooks/
  lib/
  store/
  types/
scripts/
run-dev.sh
pyproject.toml
```

## Architecture

### Backend

The backend exposes REST endpoints under `/api/v1` and a WebSocket endpoint for live agent interaction.

Main capabilities:

- Health check
- Authenticated chat session CRUD
- Authenticated chat message CRUD
- Prompt refinement via a configured Gemini model
- Remote session connect and disconnect scaffolding
- WebSocket ticket issuance and authenticated live session connections

Backend entrypoint:

```bash
uv run uvicorn uisurf_app.main:app --reload --port 8000
```

Docs when running locally:

- Swagger: [http://localhost:8000/docs](http://localhost:8000/docs)
- ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)

### Frontend

The frontend is a protected workspace app built with Next.js App Router, Material UI, React Query, and Zustand.

Main UI areas:

- Login screen backed by Firebase email/password auth
- Chat sidebar for session selection
- Main chat workspace
- Right-side VNC/viewer panel
- WebSocket provider for live agent communication

Frontend entrypoint:

```bash
cd ui
yarn dev
```

## Requirements

### Backend

- Python 3.11+
- `uv`

### Frontend

- Node.js 20+
- Yarn 1.x

## Local Setup

### 1. Install backend dependencies

```bash
uv sync
```

### 2. Install frontend dependencies

```bash
cd ui
yarn install
cd ..
```

### 3. Configure environment variables

Create a backend env file:

```bash
cp .env.example .env
```

Create a frontend env file manually at `ui/.env.local`.

Recommended local `ui/.env.local` values:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## Environment Variables

### Backend `.env`

Defined in [`.env.example`](/Users/haruiz/open-source/uisurf-app/.env.example):

- `APP_NAME`: FastAPI application name
- `APP_VERSION`: API version string
- `API_PREFIX`: route prefix, defaults to `/api/v1`
- `DEBUG`: FastAPI debug mode
- `HOST`: bind host
- `PORT`: backend port
- `RELOAD`: enables `uvicorn` reload
- `CORS_ORIGINS`: allowed frontend origins as JSON array
- `FIREBASE_PROJECT_ID`: Firebase project id
- `FIREBASE_CLIENT_EMAIL`: Firebase service account client email
- `FIREBASE_PRIVATE_KEY`: Firebase service account private key
- `FIRESTORE_DATABASE_ID`: Firestore database id
- `GOOGLE_API_KEY`: Google API key used by prompt refinement and related services
- `CHAT_SESSION_APP_NAME`: ADK session app name
- `PROMPT_REFINE_MODEL`: model used for prompt refinement
- `UI_AGENT_API_BASE_URL`: optional external UI-agent service base URL
- `UI_AGENT_CONTROL_MODE`: mode passed to the UI-agent session service
- `UI_AGENT_TIMEOUT_SECONDS`: timeout for UI-agent service calls
- `GOOGLE_GENAI_USE_VERTEXAI`: toggles Vertex-backed Google GenAI configuration
- `GOOGLE_CLOUD_PROJECT`: Google Cloud project id
- `GOOGLE_CLOUD_LOCATION`: Vertex AI region
- `VERTEX_AI_AGENT_ENGINE_ID`: Agent Engine id for ADK session storage

Notes:

- Firebase admin credentials are required for backend token verification.
- Vertex-backed ADK session storage is only used when both `GOOGLE_CLOUD_PROJECT` and `VERTEX_AI_AGENT_ENGINE_ID` are set.
- Without that Vertex configuration, the app falls back to in-memory ADK session storage.
- `UI_AGENT_API_BASE_URL` is optional. If omitted, chat sessions still work, but VNC session provisioning is disabled.

### Frontend `ui/.env.local`

Required by the frontend runtime:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

## Running The App

### Start both services

The repository includes a helper script that starts FastAPI on port `8000` and Next.js on port `3000`:

```bash
./run-dev.sh
```

The script also attempts to stop existing processes already using those ports.

### Start services manually

Backend:

```bash
uv run uvicorn uisurf_app.main:app --reload --port 8000
```

Frontend:

```bash
cd ui
yarn dev
```

## Authentication Flow

1. The user signs in through the Next.js login form with Firebase email/password auth.
2. The client retrieves a Firebase ID token.
3. NextAuth exchanges that token through a credentials provider.
4. The backend verifies bearer tokens with Firebase Admin for protected REST routes.
5. WebSocket connections use short-lived tickets issued by `POST /api/v1/ws/tickets`.

## API Surface

Key routes currently implemented:

- `GET /api/v1/health`
- `GET /api/v1/chats`
- `POST /api/v1/chats`
- `GET /api/v1/chats/{chat_id}`
- `DELETE /api/v1/chats/{chat_id}`
- `GET /api/v1/messages/chat/{chat_id}`
- `POST /api/v1/messages/chat/{chat_id}`
- `DELETE /api/v1/messages/chat/{chat_id}`
- `POST /api/v1/prompts/refine`
- `POST /api/v1/remote-sessions/connect`
- `POST /api/v1/remote-sessions/disconnect`
- `GET /api/v1/remote-sessions/{session_id}`
- `GET /api/v1/remote-sessions/{session_id}/actions`
- `POST /api/v1/ws/tickets`
- `WS /api/v1/ws/receive/{user_id}/{session_id}`

## Current Implementation Notes

- Chat sessions are persisted through an ADK session service.
- Chat message listing is reconstructed from ADK session events.
- Message creation currently appends to in-memory state inside `ChatService`.
- Remote session connect and action history are scaffolded in memory.
- Prompt refinement depends on the configured Google model and credentials.
- Live WebSocket orchestration can delegate to browser and desktop A2A agents when a VNC URL is available.
- The `legacy/` package contains older implementation code kept for reference and cleanup.

## Development Notes

- The checked-in `ui/node_modules/` directory makes the repository larger than normal; avoid using it as documentation for project structure.
- `sessions.db` exists in the repo root and should be treated as local state, not source documentation.
- There is no dedicated frontend `.env` example file in the repo today; the values above are based on the runtime validation code.
