# Technical Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         iOS App (React Native)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Pull      │  │   Agent     │  │   Voice     │              │
│  │   Inbox     │  │   Search    │  │   Mode      │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Priority  │  │   Compose   │  │   Archive   │              │
│  │   Engine    │  │   & Reply   │  │   Manager   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                         │                                        │
│                    Local Cache                                   │
│                    (SQLite)                                      │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Backend Services                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │     API     │  │    Auth     │  │    Sync     │              │
│  │   Gateway   │  │   Service   │  │   Service   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Agent     │  │    Tone     │  │   Archive   │              │
│  │   Service   │  │   Service   │  │   Service   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│  ┌─────────────┐  ┌─────────────┐                               │
│  │  Priority   │  │   Context   │                               │
│  │   Engine    │  │   Memory    │                               │
│  └─────────────┘  └─────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External Services                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Microsoft  │  │   OneDrive  │  │   Claude/   │              │
│  │  Graph API  │  │   Storage   │  │   OpenAI    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│  ┌─────────────┐                                                 │
│  │   Supabase  │  (PostgreSQL + Auth + Storage)                  │
│  └─────────────┘                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Mobile Architecture

### Technology Stack
- **Framework:** React Native with Expo
- **UI Library:** Pencil (shadcn-based components)
- **State Management:** React Context + Zustand
- **Local Storage:** SQLite (via expo-sqlite)
- **Networking:** React Query + Axios
- **Navigation:** Expo Router

### Key Components

```
src/
├── app/                    # Expo Router screens
│   ├── (tabs)/            # Tab navigation
│   │   ├── inbox.tsx      # Pull inbox
│   │   ├── search.tsx     # Agent search
│   │   └── settings.tsx   # User preferences
│   └── (modals)/          # Modal screens
│       ├── compose.tsx    # Email compose
│       └── thread.tsx     # Thread view
├── components/
│   ├── inbox/
│   │   ├── EmailCard.tsx
│   │   ├── PriorityBadge.tsx
│   │   └── ToneIndicator.tsx
│   ├── search/
│   │   ├── SearchInput.tsx
│   │   ├── QueryResult.tsx
│   │   └── ToolTrace.tsx
│   └── common/
│       ├── Header.tsx
│       └── LoadingState.tsx
├── services/
│   ├── microsoft/
│   │   ├── auth.ts        # OAuth handling
│   │   ├── mail.ts        # Email operations
│   │   └── onedrive.ts    # File operations
│   ├── agent/
│   │   ├── tools.ts       # Tool implementations
│   │   └── orchestrator.ts # Query processing
│   └── sync/
│       ├── pull.ts        # Pull mechanism
│       └── cache.ts       # Local caching
├── stores/
│   ├── emailStore.ts      # Email state
│   ├── priorityStore.ts   # Priority rules
│   └── settingsStore.ts   # User preferences
└── utils/
    ├── tone.ts            # Tone analysis
    └── archive.ts         # Archive formatting
```

### Native Modules (Swift)

For iOS-specific features:

```swift
// CallDirectoryExtension - Call blocking (future)
// MessageFilterExtension - SMS filtering (future)
// SiriIntents - Siri shortcuts
// BackgroundTasks - Offline sync
```

## Backend Architecture

### Service Breakdown

| Service | Responsibility | Technology |
|---------|---------------|------------|
| API Gateway | Request routing, auth, rate limiting | Node.js + Express |
| Auth Service | OAuth token management, session handling | Node.js |
| Sync Service | Microsoft Graph sync, delta queries | Node.js + Bull queues |
| Agent Service | Natural language processing, tool orchestration | Node.js + Claude API |
| Tone Service | Sentiment analysis, baseline calibration | Node.js + Python ML |
| Archive Service | Markdown generation, OneDrive upload | Node.js |
| Priority Engine | Rule evaluation, score calculation | Node.js |
| Context Memory | Conversation tracking, summarization | Node.js + Redis |

### Database Schema (PostgreSQL)

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY,
  microsoft_id TEXT UNIQUE,
  email TEXT,
  created_at TIMESTAMP,
  settings JSONB
);

-- Emails (cached metadata)
CREATE TABLE emails (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  microsoft_id TEXT,
  thread_id TEXT,
  subject TEXT,
  from_address TEXT,
  from_name TEXT,
  to_addresses TEXT[],
  cc_addresses TEXT[],
  received_at TIMESTAMP,
  priority INTEGER,
  tone TEXT,
  is_read BOOLEAN,
  cached_at TIMESTAMP
);

-- Priority Rules
CREATE TABLE priority_rules (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  rule_type TEXT, -- 'sender', 'subject', 'combination'
  rule_value TEXT,
  priority INTEGER,
  push_notify BOOLEAN,
  created_at TIMESTAMP
);

-- Context Memory
CREATE TABLE context_memory (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  thread_id TEXT,
  context_type TEXT, -- 'handoff', 'summary', 'entities'
  content JSONB,
  created_at TIMESTAMP,
  expires_at TIMESTAMP
);

-- Archive Index
CREATE TABLE archive_index (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  email_id UUID REFERENCES emails(id),
  onedrive_path TEXT,
  archived_at TIMESTAMP
);
```

## Microsoft Graph API Integration

### Authentication Flow

```
1. User initiates login
2. App opens Microsoft OAuth URL
3. User authenticates on Microsoft page
4. Microsoft redirects to app with auth code
5. App exchanges code for access token + refresh token
6. Tokens stored securely (iOS Keychain)
7. Access token used for API calls
8. Refresh token used when access token expires
```

### Required Permissions

```javascript
const scopes = [
  'User.Read',
  'Mail.Read',
  'Mail.ReadWrite',
  'Mail.Send',
  'Files.ReadWrite',
  'Files.ReadWrite.All',
  'offline_access'
];
```

### Key Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /me/messages` | List emails |
| `GET /me/messages/{id}` | Get specific email |
| `POST /me/sendMail` | Send email |
| `GET /me/mailFolders` | List folders |
| `GET /me/drive/root/children` | List OneDrive files |
| `POST /me/drive/root/children` | Create OneDrive folder |
| `PUT /me/drive/items/{id}/content` | Upload file to OneDrive |
| `GET /me/events` | List calendar events |
| `POST /me/events` | Create calendar event |

### Delta Queries (Incremental Sync)

```javascript
// Initial sync
GET /me/messages/delta

// Response includes @odata.deltaLink
// Use this link for subsequent syncs
GET {deltaLink}

// Only changed messages returned
```

## OneDrive Integration

### Attachment Save Flow

```
1. User opens email with attachment
2. User taps "Save to OneDrive"
3. App shows folder picker (or uses default)
4. App uploads attachment via Graph API
5. File syncs to user's work PC automatically
6. App records path in archive index
```

### Archive Folder Structure

```
/Lines Archive/
├── 2025/
│   ├── Q1/
│   │   ├── January/
│   │   │   ├── 2025-01-15_john-smith_budget-review.md
│   │   │   └── 2025-01-16_sarah-jones_project-update.md
│   │   └── February/
│   └── Q2/
└── Attachments/
    └── 2025/
        └── Q1/
            └── budget_v3_john-smith.xlsx
```

## Agent Service Architecture

### Tool Implementations

```javascript
// Core tools
const tools = {
  read: async (emailId) => {
    // Fetch full email content
    // Return body, headers, metadata
  },
  
  grep: async (pattern, options) => {
    // Search across cached emails
    // Support regex patterns
    // Return matching messages
  },
  
  glob: async (pattern, options) => {
    // Match subject/filename patterns
    // Support wildcards
    // Return matches
  },
  
  fetch: async (criteria) => {
    // Retrieve related messages
    // Fetch entire threads
    // Get messages by date range
  },
  
  summarize: async (content, length) => {
    // Use LLM to condense
    // Return bullet points or paragraph
  },
  
  analyze_tone: async (content) => {
    // Run sentiment analysis
    // Return score + explanation
  },
  
  extract: async (content, type) => {
    // Pull structured data
    // dates, commitments, contacts
  },
  
  diff: async (file1, file2) => {
    // Compare document versions
    // Highlight changes
  }
};
```

### Query Processing Flow

```
1. User submits natural language query
2. Agent service parses intent
3. Agent selects appropriate tools
4. Agent executes tools in sequence
5. Agent synthesizes results
6. Agent returns formatted response with explanation
```

## Security Architecture

### Data Protection

- **In Transit:** TLS 1.3 for all API calls
- **At Rest:** AES-256 encryption for cached emails
- **Tokens:** iOS Keychain for OAuth tokens
- **Keys:** User-specific encryption keys

### Authentication

- OAuth 2.0 with PKCE for Microsoft
- JWT for Lines backend (short expiry + refresh)
- Biometric auth option for app unlock

### Privacy

- Emails cached locally, not stored on Lines servers
- Only metadata synced to backend for priority/rules
- User controls archive retention
- Export/delete on demand

## Performance Targets

| Metric | Target |
|--------|--------|
| App Launch | < 2 seconds |
| Pull Inbox Load | < 1 second |
| Search Query | < 3 seconds |
| Email Sync | < 5 seconds for 100 messages |
| Archive Export | < 10 seconds per email |
| Voice Response | < 2 seconds latency |
