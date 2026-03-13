# Onboarding Module - Agent-Driven Contact Learning

## Overview

This module provides **role-based onboarding** that learns user preferences through conversation. The agent asks smart questions based on the user's detected job function.

## Key Principle: No Manual Tags

Instead of managing complex tag systems, users answer a few role-appropriate questions and the agent learns their preferences.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Profile (Graph API)                      │
│  - jobTitle, department, manager, directReports                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RoleDetectorService                          │
│  - Detects role from job title patterns                         │
│  - Identifies executives, managers, ICs                         │
│  - Confidence: high/medium/low                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OnboardingAgentService                       │
│  - Generates role-specific questions                            │
│  - Pre-fills CYA contacts (manager, executives)                 │
│  - Collects answers, generates summary                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OnboardingSummary                            │
│  - Always-push contacts (manager, executives, user selections)  │
│  - Company-level rules (customers push, vendors pull)           │
│  - Default external behavior                                    │
└─────────────────────────────────────────────────────────────────┘
```

## Supported Roles

| Role | Detection Patterns | Key Questions |
|------|-------------------|---------------|
| **Sales** | Sales, Account Exec, BD, Customer Success | Customers, Prospects, Partners, Vendors |
| **Purchasing** | Procurement, Buyer, Sourcing, Supply Chain | Vendors, Internal, Partners, Sales Reps |
| **Executive** | CEO, VP, Owner, Founder, President | Direct Reports, Board, Executives, Media |
| **Engineering** | Engineer, Developer, Architect, DevOps | Team, PMs/Designers, Vendor Support |
| **Support** | Support, Help Desk, Customer Service | Customers, Team, Escalations |
| **Marketing** | Marketing, Growth, Brand, SEO | Partners, Team, Media |
| **Finance** | Finance, Accountant, Controller, Tax | Vendors, Team, Budget Requests |
| **HR** | HR, People Ops, Recruiter, Talent | Team, Employee Inquiries, Recruiters |
| **Operations** | Operations, Admin, Project Manager | Team, Vendors, Facility/IT |
| **Legal** | Attorney, Counsel, Compliance | Team, Contract Requests, Outside Counsel |
| **IT** | IT Admin, Security, Network | Team, Support Tickets, Vendor Sales |
| **Product** | Product Manager, UX, Designer | Team, Customer Feedback, Stakeholders |

## Usage

### 1. Detect User Role

```typescript
import { getRoleDetectorService } from './services/onboarding';

const detector = getRoleDetectorService();

const roleDetection = detector.detectRole({
  user: {
    id: 'user-123',
    jobTitle: 'Sales Manager',
    department: 'Sales',
  },
  manager: { jobTitle: 'VP of Sales' },
  directReports: [],
});

console.log(roleDetection.inferredRole); // 'sales'
console.log(roleDetection.confidence);   // 'high'
```

### 2. Start Onboarding

```typescript
import { getOnboardingAgentService } from './services/onboarding';

const agent = getOnboardingAgentService();

// Pre-fill CYA contacts
const preFilledContacts = [
  {
    email: 'boss@company.com',
    name: 'Big Boss',
    relationship: 'manager',
    suggestedPreference: 'push',
    reason: 'your_manager',
  },
];

const state = agent.startOnboarding(
  userId,
  roleDetection,
  preFilledContacts
);

// Show welcome message
console.log(agent.getWelcomeMessage(roleDetection));
```

### 3. Ask Questions

```typescript
// Get current question
const question = agent.getCurrentQuestion(userId);

// Display to user
console.log(question.question);
// "For your **customers**, I suggest always pushing their emails. Does that work for you?"

console.log(question.options);
// [
//   { label: 'Yes, push', value: 'push', description: 'Always push...' },
//   { label: 'No, pull', value: 'pull', description: 'Let me check...' },
//   { label: 'Ask me each time', value: 'ask', description: "I'll decide..." }
// ]
```

### 4. Submit Answer

```typescript
const state = agent.submitAnswer(userId, 'push');

// Continue until all questions answered
while (state.status === 'in_progress') {
  const question = agent.getCurrentQuestion(userId);
  // ... display question, get answer
  agent.submitAnswer(userId, userAnswer);
}
```

### 5. Get Summary

```typescript
const summary = agent.generateSummary(userId);

console.log(agent.getCompletionMessage(summary));
// "Perfect! Here's your email priority setup:
//  Always Push (CYA): ...
//  Category Rules: ...
//  Default for Unknown: ..."
```

## Onboarding Flow Example

```
AGENT: "I see you're a **Sales Professional** focused on customer
relationships and revenue growth. Let me help you set up your email
priorities based on your role.

I'll ask a few quick questions to understand who should reach you
immediately (push) vs. who can wait for your review (pull).

I found your manager is **Jane Smith** (VP of Sales). I'll always
push emails from her - that's the CYA (Cover Your Ass) rule!"

USER: "Got it."

AGENT: "For your **customers**, I suggest always pushing their emails.
Does that work for you?"

USER: "Yes, push"

AGENT: "What about **prospects** in your pipeline? Should those be
pushed too?"

USER: "Yes"

AGENT: "Should emails from **partners** be pushed?"

USER: "Yes"

AGENT: "What about **vendors**? I typically suggest pulling those
unless urgent."

USER: "Pull"

AGENT: "Perfect! Here's your email priority setup:

**Always Push (CYA):**
- Jane Smith (your_manager)
- Executives (auto-detected): 3 people

**Category Rules:**
- customers: push
- prospects: push
- partners: push
- vendors: pull

**Default for Unknown:**
- External senders: pull
- Internal colleagues: push

You can always adjust these in Settings."
```

## Files

- `types.ts` - Onboarding data models
- `roleDetector.ts` - Role detection from Graph API
- `onboardingAgent.ts` - Conversational onboarding
- `__tests__/onboarding.test.ts` - Unit tests

## Integration with Contact System

The onboarding summary feeds into the contact system:

```typescript
// After onboarding completes
const summary = agent.generateSummary(userId);

// Apply to contact preferences
for (const contact of summary.alwaysPushContacts) {
  relationshipContextProvider.setPushPreference(contact.email, 'push');
}

// Apply company-level rules
for (const rule of summary.companyRules) {
  // Create domain-based push rules
}
```
