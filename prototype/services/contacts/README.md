# Contacts Module - Agent-Driven Contact Learning

## Overview

This module provides **relationship context** for push/pull email decisions without manual tagging. The agent learns who matters through:

1. **Auto-detection** - Manager, executives, direct reports from Graph API
2. **Role-based onboarding** - Agent asks smart questions based on user's job
3. **Progressive learning** - Asks about new senders as they appear

## Key Principle: No Manual Tags

Instead of managing complex tag systems, users set a simple **push/pull preference** per contact. Everything else is auto-detected.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Contact Sources                              │
├──────────────────┬──────────────────┬───────────────────────────┤
│ Outlook Contacts │ People API       │ Org Hierarchy             │
│ (user's address │ (relevance-       │ (manager, direct reports) │
│  book)          │  ranked)          │                           │
└────────┬─────────┴────────┬─────────┴───────────┬───────────────┘
         │                │                      │
         └────────────────┴──────────────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │  ContactSyncService    │
         │  - Merges all sources  │
         │  - Normalizes data     │
         └───────────┬────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │ ContactIndex           │
        │ - byEmail (Map)        │
        │ - byPhone (Map)        │
        │ - byId (Map)           │
        └───────────┬────────────┘
                    │
                    ▼
    ┌───────────────────────────────┐
    │ RelationshipContextProvider   │
    │ - getContactContext()         │
    │ - getPushDecision()           │
    │ - setPushPreference()         │
    └───────────────────────────────┘
```

## Usage

### 1. Initial Sync (on user login)

```typescript
import { getContactSyncService, getRelationshipContextProvider } from './services/contacts';

// Configure and sync contacts
const syncService = getContactSyncService();
syncService.setConfig({
  userId: 'user@example.com',
  userEmail: 'user@example.com',
  userDomain: 'example.com',
  graphClient: graphClient,
  enablePeopleApi: true,
  enableOrgHierarchy: true,
});

const stats = await syncService.syncAll();
console.log(`Synced ${stats.totalContacts} contacts`);
```

### 2. Get push decision for an email

```typescript
const contextProvider = getRelationshipContextProvider();
contextProvider.initialize({
  userDomain: 'example.com',
  managerEmail: 'boss@example.com',
});

// When email arrives
const decision = contextProvider.getPushDecision('sender@example.com', {
  isDirectRecipient: true,
  hasUrgentKeywords: false,
  isHighImportance: false,
});

if (decision.shouldPush) {
  console.log(`PUSH: ${decision.reason} (priority: ${decision.priority})`);
} else {
  console.log(`PULL: ${decision.reason}`);
}
```

### 3. Handle new sender (progressive disclosure)

```typescript
// Unknown sender - prompt user
const prompt = contextProvider.createNewSenderPrompt('unknown@external.com');

// Show UI:
// "New sender: unknown@external.com. Should emails from this person be pushed or pulled?"
// [Push] [Pull] [Ask each time] [Ignore]

// After user selects
contextProvider.setPushPreference('unknown@external.com', 'push');
```

## Auto-Detection Rules

| Detection | Source | Rule |
|-----------|--------|------|
| Manager | `/me/manager` | Always push (high priority) |
| Executive | Job title | CEO, C-level, VP, Owner, Founder, Director |
| Direct Report | `/me/directReports` | Push if urgent |
| Internal | Email domain | Same domain as user |
| Favorite | People API | User starred in Outlook |

## Push Decision Priority

```
1. Manager (your_manager)           → HIGH priority, always push
2. Executive (executive)             → HIGH priority, always push
3. User push preference              → MEDIUM priority
4. Frequent contact (relevance≥7)    → MEDIUM priority
5. Favorite contact                  → MEDIUM priority
6. Internal colleague                → LOW priority
7. Unknown external                  → PULL (default)
```

## Onboarding Flow (Future)

```
AGENT: "I see you're in Sales at Acme Corp. Let me help you set up your
email priorities. I found your manager is [Manager Name], and you have
3 direct reports. Is that correct?"

USER: "Yes"

AGENT: "Great! For sales, I typically push messages from customers and
prospects. Would you like me to push all customer emails?"

USER: "Yes"

AGENT: "Got it. What about vendors and partners?"

... (conversational onboarding)
```

## API Reference

### ContactSyncService

```typescript
class ContactSyncService {
  setConfig(config: ContactSyncConfig): void;
  syncAll(): Promise<ContactSyncStats>;
  getContactByEmail(email: string): Contact | null;
  getContactByPhone(phone: string): Contact | null;
  getAllContacts(): Contact[];
}
```

### RelationshipContextProvider

```typescript
class RelationshipContextProvider {
  initialize(config: { userDomain?: string; managerEmail?: string }): void;
  getContactContext(email: string): ContactContext;
  getPushDecision(email: string, context?: object): PushDecisionWithContext;
  createNewSenderPrompt(email: string): NewSenderPrompt;
  setPushPreference(email: string, preference: ContactPushPreference): boolean;
  getCYAContacts(): { manager, executives, directReports };
}
```

## Future Enhancements

- Role-based onboarding agent
- SMS/voicemail contact matching (iOS)
- Calendar attendee integration
- Teams message integration
- Company-based push rules (all customers @company.com)

## Files

- `types.ts` - Contact data models
- `contactSyncService.ts` - Graph API sync
- `relationshipContextProvider.ts` - Push decision logic
- `__tests__/contactSystem.test.ts` - Integration tests
