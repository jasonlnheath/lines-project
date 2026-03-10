# Issue Validation Test Specifications

## Overview

Test specifications for validating the 12 existing GitHub issues in the lines-project.

## Test Categories

### Phase 0: Build & Infrastructure
- **Issue #1**: Next.js Build Verification

### Phase 1: Authentication & Core Services
- **Issue #2**: Microsoft Graph OAuth
- **Issue #3**: Agent Service Core

### Phase 2: Agent Tools (Issues #4-8)
- **Issue #4**: Read Tool
- **Issue #5**: Grep Tool
- **Issue #6**: Glob Tool
- **Issue #7**: Fetch Tool
- **Issue #8**: Summarize Tool

### Phase 3: UI & Integration
- **Issue #9**: Web UI
- **Issue #10**: OneDrive Integration

### Phase 4: End-to-End
- **Issue #11**: E2E Agent Search

### Phase 5: Documentation
- **Issue #12**: Documentation Review

---

## Test Specifications

### TEST-001: Build Verification (Issue #1)

**Given**: The Next.js project exists at `prototype/`
**When**: Running `npm run build`
**Then**: Build completes without errors
**And**: Output shows successful compilation

**Acceptance Criteria**:
- `npm run build` exits with code 0
- No TypeScript errors
- No ESLint errors
- `.next` directory is created

---

### TEST-002: Authentication Flow (Issue #2)

**Given**: User is not authenticated
**When**: Visiting `/api/auth/login`
**Then**: Redirects to Microsoft login
**And**: Callback receives valid tokens
**And**: `/api/auth/me` returns user profile

**Acceptance Criteria**:
- Login endpoint redirects to `https://login.microsoftonline.com`
- Callback exchanges code for access_token
- User profile contains: displayName, mail, id
- Tokens are stored in secure cookies

**Edge Cases**:
- Invalid state parameter
- Expired authorization code
- Missing client credentials

---

### TEST-003: Agent Query Processing (Issue #3)

**Given**: User is authenticated
**When**: POST `/api/agent/query` with "show me emails from today"
**Then**: Response contains structured results
**And**: Response includes tool trace

**Acceptance Criteria**:
- Response has `results` array
- Response has `toolTrace` array
- Each tool trace shows: toolName, duration, status
- Query completes in under 5 seconds

---

### TEST-004: Read Tool (Issue #4)

**Given**: Email ID exists in graph
**When**: Agent uses read tool with email ID
**Then**: Returns full email body
**And**: Returns headers and metadata

**Acceptance Criteria**:
- Tool returns email with: subject, from, to, body, date
- Handles HTML emails
- Handles plain text emails
- Returns error for missing emails

---

### TEST-005: Grep Tool (Issue #5)

**Given**: Emails exist in graph
**When**: Agent uses grep tool with pattern "urgent"
**Then**: Returns matching emails
**And**: Includes context snippets

**Acceptance Criteria**:
- Returns emails containing the pattern
- Case-insensitive by default
- Supports regex patterns
- Shows 50 characters of context around match

---

### TEST-006: Glob Tool (Issue #6)

**Given**: Emails with various subjects exist
**When**: Agent uses glob tool with pattern "*report*"
**Then**: Returns emails with "report" in subject

**Acceptance Criteria**:
- Supports `*` wildcard (zero or more chars)
- Supports `?` wildcard (single char)
- Searches subject lines
- Returns matching email list

---

### TEST-007: Fetch Tool (Issue #7)

**Given**: Email thread exists
**When**: Agent uses fetch tool for thread
**Then**: Returns all emails in conversation
**And**: Maintains chronological order

**Acceptance Criteria**:
- Groups by conversationId
- Returns emails sorted by date
- Includes all: sent, received, replies
- Handles orphaned emails (no conversationId)

---

### TEST-008: Summarize Tool (Issue #8)

**Given**: Email with long body exists
**When**: Agent uses summarize tool
**Then**: Returns condensed summary
**And**: Summary is under 200 words

**Acceptance Criteria**:
- Extracts key points
- Removes quoted replies
- Removes signatures
- Returns text under 200 words

---

### TEST-009: Web UI Rendering (Issue #9)

**Given**: User visits prototype homepage
**When**: Page loads
**Then**: Search input is visible
**And**: Chat panel renders correctly
**And**: Timeline view displays

**Acceptance Criteria**:
- Search input field exists
- Chat messages container exists
- Timeline container exists
- All components are responsive

---

### TEST-010: OneDrive File Upload (Issue #10)

**Given**: User is authenticated
**When**: POST `/api/onedrive/upload` with file
**Then**: File appears in OneDrive
**And**: Response contains file URL

**Acceptance Criteria**:
- Upload completes successfully
- Returns driveItem with id, name, webUrl
- File appears in OneDrive web interface
- Supports custom folder selection

---

### TEST-011: End-to-End Search Flow (Issue #11)

**Given**: User is authenticated with real emails
**When**: Submitting natural language query
**Then**: Query processes in under 3 seconds
**And**: Results are relevant to query

**Acceptance Criteria**:
- Multiple tools execute successfully
- Response time < 3 seconds
- Results contain relevant emails
- Error handling works properly

---

### TEST-012: Documentation Completeness (Issue #12)

**Given**: Documentation files exist
**When**: Reviewing documentation
**Then**: All steps are documented
**And**: Mobile transition plan exists

**Acceptance Criteria**:
- `setup_guide.md` exists and is complete
- `TESTING_GUIDE.md` exists with scenarios
- Mobile considerations documented
- Prototype results recorded

---

## Test Execution Order

Tests should be executed in order to minimize dependencies:

1. **TEST-001** (Build) - No dependencies
2. **TEST-002** (Auth) - Requires build
3. **TEST-003** (Agent Core) - Requires auth
4. **TEST-004** to **TEST-008** (Tools) - Require agent core
5. **TEST-009** (UI) - Requires build
6. **TEST-010** (OneDrive) - Requires auth
7. **TEST-011** (E2E) - Requires everything
8. **TEST-012** (Docs) - No dependencies

---

## Performance Benchmarks

| Test | Target Metric |
|------|--------------|
| TEST-001 | Build < 30s |
| TEST-002 | Auth flow < 5s |
| TEST-003 | Agent query < 5s |
| TEST-004 | Read tool < 500ms |
| TEST-005 | Grep tool < 1s |
| TEST-006 | Glob tool < 500ms |
| TEST-007 | Fetch tool < 2s |
| TEST-008 | Summarize < 1s |
| TEST-009 | Page load < 2s |
| TEST-010 | Upload (1MB) < 5s |
| TEST-011 | E2E query < 3s |

---

## Test Status Tracking

| Test | Status | Last Run | Result |
|------|--------|----------|--------|
| TEST-001 | ⬜ Pending | - | - |
| TEST-002 | ⬜ Pending | - | - |
| TEST-003 | ⬜ Pending | - | - |
| TEST-004 | ⬜ Pending | - | - |
| TEST-005 | ⬜ Pending | - | - |
| TEST-006 | ⬜ Pending | - | - |
| TEST-007 | ⬜ Pending | - | - |
| TEST-008 | ⬜ Pending | - | - |
| TEST-009 | ⬜ Pending | - | - |
| TEST-010 | ⬜ Pending | - | - |
| TEST-011 | ⬜ Pending | - | - |
| TEST-012 | ⬜ Pending | - | - |
