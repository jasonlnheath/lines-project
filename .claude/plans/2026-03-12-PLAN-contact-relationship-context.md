# Plan: Agent-Driven Contact Learning System

## Context

**Problem:** The Lines email agent lacks context about senders' relationships to the user. This makes push/pull decisions less intelligent and the agent less helpful for business users.

**User Insight:** Manual tagging SUCKS - users don't manage tags well. Instead, the agent should learn through **role-based onboarding** that asks smart questions based on the user's job function. Keep it simple: just push or pull.

**Current State:**
- Lines is a Next.js/TypeScript prototype at `C:\dev\lines-project\prototype`
- No dedicated Contact model - senders are just email address strings
- Microsoft Graph API already integrated for email (scopes: Mail.Read, Mail.ReadWrite, Mail.Send, Files.ReadWrite)
- Push/pull logic exists in `services/pushPull/pushTriggerService.ts` with VIP sender support

**Future Channels (Critical):** SMS, voicemail transcriptions, voice recordings - iOS-first architecture required.

**Opportunity:** Microsoft Graph + iOS Contacts provide relationship context that enables the agent to:
1. **Auto-detect important relationships** (manager, executives, direct reports)
2. **Ask role-based onboarding questions** (not manual tagging)
3. **Learn push/pull preferences** through conversation

---

## Proposed Solution: Agent-Driven Contact Learning

### Core Principle: No Manual Tags

Instead of tags, the agent learns through:
1. **Auto-detected relationships** (from Graph API org hierarchy)
2. **Onboarding interview** (role-based questions)
3. **Progressive learning** (ask on first contact from new sender)

### Phase 1: Contact Data Model & Sync

**New Files:**
- `services/contacts/types.ts` - Contact data models
- `services/contacts/contactSyncService.ts` - Sync from Graph API + iOS
- `services/contacts/relationshipContextProvider.ts` - Relationship lookup

**Simplified Contact Model (No Tags):**
```typescript
interface Contact {
  // Identity
  id: string;
  emailAddresses: string[];
  phoneNumbers: string[];  // For SMS/voicemail matching

  // Basic info (from Outlook/iOS)
  displayName: string;
  companyName: string;
  jobTitle: string;
  department: string;

  // Auto-detected relationships (NO manual tags)
  isMyManager: boolean;      // From /me/manager
  isMyDirectReport: boolean; // From /me/directReports
  isExecutive: boolean;      // C-level, VP, Owner in title
  isInternal: boolean;       // Same email domain

  // People API signals
  relevanceScore: number;    // 0-10, how often you communicate
  isFavorite: boolean;       // Starred in People

  // User-taught preferences (simple, not tags)
  pushPreference: 'push' | 'pull' | 'ask' | 'unset';

  // Source tracking
  sources: ('outlook' | 'people_api' | 'ios_contacts')[];
  lastSynced: Date;
}
```

**Key insight:** `pushPreference` is the ONLY user-controlled field. Everything else is auto-detected.

### Phase 2: Role-Based Agent Onboarding

**The Agent Asks, User Answers:**

Instead of manual tagging, the agent conducts a brief onboarding interview:

```
AGENT: "I see you're in Sales at Acme Corp. Let me help you set up your
email priorities. I found your manager is [Manager Name], and you have
3 direct reports. Is that correct?"

USER: "Yes"

AGENT: "Great! For sales, I typically push messages from customers and
prospects. Would you like me to:

1. Push all emails from people at companies you've marked as customers
2. Ask you about each new company the first time they email
3. Let you give me a list of customer domains"

USER: "Option 1 - push customer emails"

AGENT: "Got it. What about vendors and partners - do you want those
pushed too, or should they wait in your pull queue?"

USER: "Vendors can wait, partners push"

AGENT: "Perfect. I'll also always push emails from your manager
[Name] and executives (C-level, VPs). Is there anyone else who should
always reach you immediately?"

USER: "Yes, [Owner Name] - the company owner"

AGENT: "Added. Here's your push priority summary:
- Your manager: [Name]
- Company owner: [Name]
- Executives (auto-detected): 5 people
- Customer companies: [List from your contacts]
- Partners: [List from your contacts]

Everything else will wait in your pull queue. Sound good?"
```

**Role Detection Logic:**

```typescript
interface UserRole {
  department: string;      // From Graph API user profile
  jobTitle: string;
  inferredRole: 'sales' | 'purchasing' | 'executive' | 'engineering' | 'support' | 'other';
}

function getOnboardingQuestions(role: UserRole): Question[] {
  switch (role.inferredRole) {
    case 'sales':
      return [
        { ask: 'customers', suggest: 'push' },
        { ask: 'prospects', suggest: 'push' },
        { ask: 'vendors', suggest: 'pull' },
        { ask: 'partners', suggest: 'push' },
      ];
    case 'purchasing':
      return [
        { ask: 'vendors', suggest: 'push' },
        { ask: 'internal_requests', suggest: 'push' },
        { ask: 'sales_reps', suggest: 'pull' },
      ];
    case 'executive':
      return [
        { ask: 'direct_reports', suggest: 'push' },
        { ask: 'board_investors', suggest: 'push' },
        { ask: 'media', suggest: 'ask' },
      ];
    // ... other roles
  }
}
```

### Phase 3: Contact Sync (Email + iOS)

**Multi-Source Contact Sync:**

| Source | API | Data Retrieved | Use Case |
|--------|-----|----------------|----------|
| Microsoft Graph Contacts | `GET /me/contacts` | Email contacts | Email sender matching |
| Microsoft People API | `GET /me/people` | Relevance ranking | Auto-priority |
| Microsoft Manager | `GET /me/manager` | Org hierarchy | CYA (boss detection) |
| Microsoft Direct Reports | `GET /me/directReports` | Team members | Team priority |
| iOS Contacts | CNContact framework | Phone contacts | SMS/voicemail matching |

**iOS Architecture (Future-Proofing):**

Since future channels include SMS, voicemail transcriptions, and voice recordings, the contact model must support phone-number-based matching:

```typescript
// Unified contact matching
function findContactByEmailOrPhone(identifier: string): Contact | null {
  // Try email match first
  if (identifier.includes('@')) {
    return contactIndex.byEmail.get(identifier.toLowerCase());
  }
  // Normalize phone and match
  const normalizedPhone = normalizePhoneNumber(identifier);
  return contactIndex.byPhone.get(normalizedPhone);
}
```

### Phase 4: Simplified Push/Pull Rules

**Auto-Detected Priority (No User Configuration Needed):**

```typescript
// In pushTriggerService.ts
function evaluatePushTriggers(email: EmailNode, contact: Contact | null): PushDecision {

  // 1. CYA Rules (Cover Your Ass) - Always push
  if (contact) {
    if (contact.isMyManager) {
      return { push: true, reason: 'your_manager', priority: 'high' };
    }
    if (contact.isExecutive) {
      return { push: true, reason: 'executive', priority: 'high' };
    }
    if (contact.pushPreference === 'push') {
      return { push: true, reason: 'user_designated_push' };
    }
  }

  // 2. Existing MVP triggers (keep as-is)
  if (email.importance === 'high' && isDirectRecipient(email)) {
    return { push: true, reason: 'high_importance' };
  }
  if (hasTimeSensitiveKeywords(email)) {
    return { push: true, reason: 'time_sensitive' };
  }

  // 3. Contact preference (if set)
  if (contact?.pushPreference === 'pull') {
    return { push: false, reason: 'user_designated_pull' };
  }

  // 4. People API signals (frequent communicators)
  if (contact && contact.relevanceScore >= 7) {
    return { push: true, reason: 'frequent_contact' };
  }

  // 5. Internal vs External (default behavior)
  if (contact?.isInternal) {
    // Internal colleagues - moderate priority
    return { push: true, reason: 'internal_colleague' };
  }

  // Unknown external - default to pull
  return { push: false, reason: 'unknown_external' };
}
```

**Progressive Learning (First Contact from New Sender):**

```typescript
// When email arrives from unknown sender
async function handleNewSender(email: EmailNode): Promise<void> {
  // Check if in contacts but not yet in our index
  const contact = await lookupContactByEmail(email.from);

  if (contact) {
    // Found in contacts - auto-enrich
    await enrichContact(contact);
  } else {
    // Truly unknown - ask user (progressive disclosure)
    await promptUser({
      message: `New sender: ${email.from}. Should emails from this person be pushed or pulled?`,
      options: ['Push', 'Pull', 'Ask each time', 'Ignore'],
      onAnswer: async (answer) => {
        await createContact({
          email: email.from,
          pushPreference: answer === 'Push' ? 'push' :
                         answer === 'Pull' ? 'pull' : 'ask'
        });
      }
    });
  }
}
```

### Phase 5: Agent Onboarding UI

**Onboarding Flow:**

1. **Role Detection Screen:**
   - Agent shows detected role from Graph API
   - User confirms or selects different role
   - Sets the onboarding question template

2. **Priority Interview:**
   - Conversational agent asks about key contacts
   - Pre-fills with detected manager, executives, team
   - User adds any additional always-push contacts

3. **Company Category Setup (Optional):**
   - Agent scans contacts for company names
   - Groups by company domain
   - Asks: "Should [Company Name] emails be pushed?"

4. **Summary Confirmation:**
   - Shows final push rules
   - One-click adjustment if needed

**In-Email Contact Card:**

When viewing an email, show minimal contact context:
```
┌─────────────────────────────────────┐
│ 👤 John Smith                        │
│ VP of Sales, Acme Corp              │
│                                     │
│ 📊 Your relationship:               │
│   • Customer (since 2023)           │
│   • You've exchanged 47 emails      │
│                                     │
│ ⚡ Push preference: PUSH             │
│   [Change to Pull] [Ask Each Time]  │
└─────────────────────────────────────┘
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `services/msalConfig.ts` | Add `Contacts.Read`, `People.Read` scopes |
| `services/pushPull/pushTriggerService.ts` | Add auto-detected relationship triggers |
| `services/pushPull/types.ts` | Add Contact reference to PushContext |
| `components/graph/SenderAvatar.tsx` | Show relationship badges |
| NEW: `services/contacts/types.ts` | Contact data model |
| NEW: `services/contacts/contactSyncService.ts` | Graph API + iOS sync |
| NEW: `services/contacts/relationshipContextProvider.ts` | Lookup service |
| NEW: `services/onboarding/roleDetector.ts` | Detect user role from Graph |
| NEW: `services/onboarding/onboardingAgent.ts` | Conversational onboarding |
| NEW: `components/onboarding/OnboardingFlow.tsx` | Onboarding UI |

---

## Verification

1. **Unit Tests:**
   - Contact merging from multiple sources
   - Role detection logic
   - Push trigger evaluation with contacts

2. **Integration Tests:**
   - Graph API contact sync
   - Manager/direct report detection
   - iOS contact matching (phone numbers)

3. **Manual Testing:**
   - Complete onboarding flow as different roles (sales, purchasing, executive)
   - Receive email from manager → verify auto-push
   - Receive email from unknown sender → verify progressive disclosure prompt
   - Change push preference → verify persistence

---

## Key Decisions Made

1. **No manual tags** - Agent learns through onboarding interview, not user-managed tags
2. **Role-based onboarding** - Agent asks different questions based on user's job function
3. **Auto-detect CYA contacts** - Manager, executives, owner automatically pushed
4. **Simple push/pull preference** - One setting per contact, not complex categories
5. **iOS-ready architecture** - Phone number matching for future SMS/voicemail integration

---

## Future Enhancements (Post-MVP)

- SMS sender matching via iOS contacts
- Voicemail transcription sender identification
- Voice recording contact association
- Calendar integration (meeting attendees auto-prioritized)
- Teams message integration
