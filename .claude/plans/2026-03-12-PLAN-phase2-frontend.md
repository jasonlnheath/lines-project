# Phase 2 Frontend Implementation Plan

## Context

The user wants to manually test CARD-13 (Push/Pull Preferences) but discovered the Settings UI doesn't exist. The backend services are fully implemented in `prototype/services/pushPull/`, but there's no frontend to access them. This plan covers implementing UI for all Phase 2 cards (CARD-13 through CARD-22).

**Key Finding:** The autodev skill v4 already includes a REFACTOR Agent that runs after GREEN phase - no modification needed.

---

## Implementation Strategy

Use `/autodev` skill with test-first methodology for each card. Cards can be developed in parallel based on dependency groups.

### Dependency Groups

```
Sprint 1 (Foundation - Parallel):
├── TASK-001: UI Component Library
├── TASK-002: API Client Hook
└── TASK-003: Validation Utilities

Sprint 2 (API Layer - Parallel after Sprint 1):
├── TASK-004: Push/Pull API Routes
└── TASK-005: Settings Page Layout

Sprint 3 (Features - Parallel after Sprint 2):
├── CARD-13: Settings/Preferences Page
├── CARD-14: Pull Queue Interface
├── CARD-16: Progressive Disclosure Prompts
├── CARD-20: Priority Rules UI
├── CARD-21: Priority Indicators
└── CARD-22: Sync Status

Sprint 4 (Email Features - Sequential):
├── CARD-17: Email Compose UI
├── CARD-18: Send Email API
└── CARD-19: Reply/Forward Actions
```

---

## Task Cards

### Foundation Tasks

#### TASK-001: UI Component Library
**Location:** `prototype/components/ui/`
**Files:** Button, Input, TextArea, Select, Toggle, Badge, Modal, Card, Pagination, Toast, FileUpload
**Test Spec:**
- Each component renders with correct props
- Handles disabled/loading states
- Follows Tailwind patterns from existing code

#### TASK-002: API Client Hook
**Location:** `prototype/lib/hooks/useApi.ts`
**Test Spec:**
- Returns { data, loading, error, execute }
- Handles success/error responses
- Aborts on unmount

#### TASK-003: Validation Utilities
**Location:** `prototype/lib/utils/validation.ts`
**Test Spec:**
- `validateEmail()` - RFC 5322 compliant
- `validateWildcardPattern()` - supports * and ?
- `validateRequired()` - non-empty check

### API Routes

#### TASK-004: Push/Pull API Routes
**Location:** `prototype/app/api/pushpull/`

| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/preferences` | GET, POST | Preference CRUD |
| `/preferences/[id]` | DELETE | Remove preference |
| `/vip` | GET, POST | VIP sender management |
| `/vip/[id]` | DELETE | Remove VIP |
| `/keywords` | GET, POST | Time-sensitive keywords |
| `/bulk-import` | POST | Bulk import preferences |
| `/queue` | GET | Pull queue with pagination |
| `/queue/promote` | POST | Promote sender to push |
| `/triggers` | GET, POST | Custom trigger rules |
| `/triggers/[id]` | DELETE | Remove trigger |

**Pattern:** Follow `app/api/persona/route.ts` - use NextRequest/NextResponse

#### TASK-005: Settings Page Layout
**Location:** `prototype/app/settings/page.tsx`
**Test Spec:**
- Tab navigation works (Preferences, Rules, Triggers)
- Responsive layout
- Auth-gated access

---

### Feature Cards

#### CARD-13: Push/Pull Preferences Settings
**Location:** `prototype/app/settings/preferences/page.tsx`
**Backend:** `services/pushPull/pushPullService.ts`
**Test Spec:**
- Display existing preferences on load
- Add/edit/delete sender preferences
- Add/edit/delete subject patterns with wildcards
- VIP sender list with add/remove
- Bulk import with CSV upload
- Default mode indicator (Pull)

#### CARD-14: Pull Queue Interface
**Location:** `prototype/app/queue/page.tsx`
**Backend:** `services/pushPull/pullQueueService.ts`
**Test Spec:**
- Display queued emails with pagination (20/page)
- Filter by date range
- Filter by sender domain
- Promote to Push button removes from queue
- Expiration countdown display

#### CARD-16: Progressive Disclosure Prompts
**Location:** `prototype/components/prompts/`
**Test Spec:**
- Show prompt for new sender
- Show prompt for new subject pattern
- Skip dismisses without saving
- Max 3 prompts per session
- Suggest Push for frequent senders

#### CARD-17: Email Compose UI
**Location:** `prototype/app/compose/page.tsx` + `prototype/components/compose/`
**Test Spec:**
- To/CC/BCC with multi-email validation
- Subject field with character count
- Body editor
- Attachment upload area
- Send disabled until valid
- Max 100 recipients

#### CARD-18: Send Email API
**Location:** `prototype/app/api/email/send/route.ts`
**Test Spec:**
- POST sends via Microsoft Graph
- Returns message ID on success
- Handles Graph API errors
- 35MB size limit enforcement

#### CARD-19: Reply/Forward Actions
**Location:** `prototype/components/email/ReplyForwardActions.tsx`
**Test Spec:**
- Reply pre-fills To from From
- Reply All includes all original recipients
- Forward has empty To, FW: prefix
- Quote original content with attribution
- Forward includes attachments by default
- Reply excludes attachments by default

#### CARD-20: Priority Rules UI
**Location:** `prototype/app/settings/rules/page.tsx`
**Test Spec:**
- List existing rules with enable/disable toggle
- Create rule (sender/subject/body type)
- Regex pattern validation
- Delete rule with confirmation
- Rule ordering

#### CARD-21: Priority Indicators
**Location:** `prototype/components/email/PriorityIndicator.tsx`
**Test Spec:**
- High priority = red badge
- Medium priority = yellow badge
- Low priority = gray badge
- Sort by priority (High→Medium→Low→Normal)
- Filter by priority level
- Keyboard shortcuts (H/M/L)

#### CARD-22: Sync Status
**Location:** `prototype/components/sync/SyncStatusIndicator.tsx`
**Test Spec:**
- Progress percentage during sync
- Success notification on complete
- Error notification with retry
- Last sync timestamp (relative time)

---

## File Structure

```
prototype/
├── app/
│   ├── settings/
│   │   ├── page.tsx                 # Layout with tabs
│   │   ├── preferences/page.tsx     # CARD-13
│   │   ├── rules/page.tsx           # CARD-20
│   │   └── triggers/page.tsx        # Optional admin
│   ├── queue/page.tsx               # CARD-14
│   ├── compose/page.tsx             # CARD-17
│   └── api/
│       ├── pushpull/                # TASK-004
│       │   ├── preferences/route.ts
│       │   ├── vip/route.ts
│       │   ├── keywords/route.ts
│       │   ├── bulk-import/route.ts
│       │   ├── queue/route.ts
│       │   └── triggers/route.ts
│       ├── email/
│       │   ├── send/route.ts        # CARD-18
│       │   ├── reply/[id]/route.ts  # CARD-19
│       │   └── forward/[id]/route.ts
│       └── sync/status/route.ts     # CARD-22
├── components/
│   ├── ui/                          # TASK-001
│   ├── prompts/                     # CARD-16
│   ├── compose/                     # CARD-17
│   ├── email/                       # CARD-19, CARD-21
│   └── sync/                        # CARD-22
└── lib/
    ├── hooks/
    │   ├── useApi.ts                # TASK-002
    │   ├── usePreferences.ts
    │   └── useQueue.ts
    └── utils/
        └── validation.ts            # TASK-003
```

---

## Verification

### Manual Testing
After implementation, run through `specs/phase2-manual-testing.md`:
1. Start dev server: `cd prototype && npm run dev`
2. Sign in with Microsoft account
3. Navigate to Settings → Push/Pull Preferences
4. Test each card's functionality per spec

### Automated Testing
```bash
cd prototype
npx ts-node tests/phase2-validation.test.ts
```

---

## Autodev Execution

For each task card, run:
```
/autodev lines-project --mode=test-first
```

The autodev v4 workflow will:
1. **SPEC** - Generate test specification
2. **RED** - Confirm test fails
3. **GREEN** - OODA loop until tests pass
4. **TEST** - Independent verification
5. **REFACTOR** - Code quality improvements (already included!)
6. **VERIFY** - Final build and commit

Run Sprint 1 tasks in parallel (3 terminals), then Sprint 2, etc.
