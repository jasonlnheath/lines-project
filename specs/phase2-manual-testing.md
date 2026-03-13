# Phase 2 Manual Testing Guide

This guide provides step-by-step manual testing procedures for each Phase 2 card. Complete these tests after automated tests pass to verify real-world functionality.

---

## Prerequisites

1. **Environment Setup**
   ```bash
   cd prototype
   npm install
   npm run dev
   ```
   App runs at: `http://localhost:3000`

2. **Authentication**
   - Sign in with Microsoft account
   - Grant required permissions (Mail.Read, Mail.Send, Files.ReadWrite)

3. **Test Data**
   - Have at least 10 test emails in inbox
   - Have at least 1 sent email
   - Have at least 1 email with attachment

---

## CARD-13: Push/Pull Data Model

### Test 1: Sender Preference Persistence
1. Navigate to Settings → Push/Pull Preferences
2. Add a new sender preference:
   - Email: `test@example.com`
   - Mode: `Push`
3. Refresh the page
4. **Expected**: Preference for `test@example.com` shows `Push` mode

### Test 2: Subject Preference Persistence
1. Add a subject preference:
   - Pattern: `Project * Update`
   - Mode: `Pull`
2. Refresh the page
3. **Expected**: Pattern preference persists

### Test 3: Default Behavior
1. Check preference for a new sender `new@unknown.com`
2. **Expected**: Returns `Pull` (default mode)

### Test 4: VIP Sender Management
1. Add VIP sender: `boss@company.com`
2. Send test email from this address
3. **Expected**: Email triggers push notification

### Test 5: Wildcard Matching
1. Set preference for subject pattern `Urgent *`
2. Receive email with subject `Urgent Project Update`
3. **Expected**: Wildcard pattern matches

### Test 6: Bulk Import
1. Import 50 preferences via Settings → Import
2. **Expected**: All preferences saved within 1 second

---

## CARD-14: Pull Queue Manager

### Test 1: Queue Non-Push Emails
1. Receive email from sender with `Pull` preference
2. Navigate to Pull Queue
3. **Expected**: Email appears in queue

### Test 2: Exclude Push-Eligible Emails
1. Receive email from VIP sender
2. Check Pull Queue
3. **Expected**: Email NOT in queue

### Test 3: Paginated Retrieval
1. Queue 100+ emails
2. Request page 2 (20 per page)
3. **Expected**: Shows emails 21-40

### Test 4: Queue Persistence
1. Add emails to queue
2. Restart application
3. **Expected**: Queue preserved after restart

### Test 5: Promote to Push
1. Find email in queue from `colleague@company.com`
2. Change sender preference to `Push`
3. **Expected**: Email removed from queue

### Test 6: Queue Filtering
1. Filter queue by date range (last 7 days)
2. Filter by sender domain `@company.com`
3. **Expected**: Only matching emails shown

### Test 7: Expiration
1. Add email older than 30 days
2. Run expiration cleanup
3. **Expected**: Old email removed from queue

---

## CARD-15: Push Trigger Engine

### Test 1: High Importance Detection
1. Receive email with importance flag `High`
2. **Expected**: Push triggered

### Test 2: Direct Recipient Detection
1. Receive email where you're in `To:` field
2. Receive email where you're only in `CC:` field
3. **Expected**: Push for To, no push for CC-only

### Test 3: VIP Sender Match
1. Add `boss@company.com` as VIP
2. Receive email from this address
3. **Expected**: Push triggered

### Test 4: Domain Wildcard
1. Add VIP domain `@executive.company.com`
2. Receive email from `anyone@executive.company.com`
3. **Expected**: Push triggered

### Test 5: Time-Sensitive Keywords
1. Receive email with subject containing `URGENT`
2. Receive email with body containing `ASAP`
3. **Expected**: Push triggered for both

### Test 6: Custom Rules
1. Create rule: Subject contains `[ACTION]`
2. Receive email with subject `[ACTION] Review needed`
3. **Expected**: Push triggered

### Test 7: Performance
1. Process 100 emails through trigger engine
2. **Expected**: Each evaluation completes in < 10ms

---

## CARD-16: Progressive Disclosure Onboarding

### Test 1: New Sender Prompt
1. Receive first email from `newperson@company.com`
2. **Expected**: Onboarding prompt appears

### Test 2: Known Sender No Prompt
1. Set preference for `known@company.com`
2. Receive email from this sender
3. **Expected**: No prompt shown

### Test 3: Skip Functionality
1. When prompted, click "Skip"
2. **Expected**: No more prompts for this sender this session

### Test 4: Prompt Limit
1. Trigger 5 prompts in one session
2. **Expected**: Maximum 3 prompts shown

### Test 5: VIP Pattern Suggestion
1. Receive 3 emails from same sender in 1 hour
2. **Expected**: System suggests `Push` for this sender

### Test 6: Learning Patterns
1. Always respond `Push` for emails containing "urgent"
2. After 5 occurrences
3. **Expected**: System learns and auto-suggests Push

---

## CARD-17: Email Compose UI

### Test 1: Required Field Validation
1. Open compose
2. Click Send without filling To
3. **Expected**: Validation error shown

### Test 2: Email Format Validation
1. Enter invalid email: `not-an-email`
2. **Expected**: Format error shown

### Test 3: Multiple Recipients
1. Enter: `a@b.com, c@d.com; e@f.com`
2. **Expected**: All three parsed correctly

### Test 4: Angle Bracket Format
1. Enter: `John Doe <john@company.com>`
2. **Expected**: Email extracted correctly

### Test 5: Empty Body Warning
1. Fill To, leave subject and body empty
2. **Expected**: Warning confirmation dialog

### Test 6: Maximum Recipients
1. Add 101 recipients
2. **Expected**: Error - exceeds 100 limit

### Test 7: Form State Preservation
1. Fill compose form
2. Trigger validation error
3. **Expected**: All entered data preserved

---

## CARD-18: Send Email API

### Test 1: Basic Send
1. Compose email with To, Subject, Body
2. Click Send
3. **Expected**: Success, email in Sent folder

### Test 2: HTML Content
1. Compose email with formatting (bold, links)
2. Send
3. **Expected**: Formatting preserved in sent email

### Test 3: Attachments
1. Attach file (PDF, image)
2. Send
3. **Expected**: Attachment delivered

### Test 4: Importance Level
1. Set importance to `High`
2. Send
3. **Expected**: Importance flag set in sent email

### Test 5: Size Limit
1. Attach 36MB file
2. **Expected**: Error - exceeds 35MB limit

### Test 6: Network Timeout
1. Simulate slow network
2. **Expected**: Graceful timeout error, retry option

---

## CARD-19: Reply/Forward Actions

### Test 1: Reply Pre-fill
1. Open email from `sender@company.com`
2. Click Reply
3. **Expected**: To field = `sender@company.com`

### Test 2: Reply All Recipients
1. Open email with multiple To/CC
2. Click Reply All
3. **Expected**: All original recipients included (except you)

### Test 3: Forward Empty To
1. Open any email
2. Click Forward
3. **Expected**: To field empty, subject prefixed with `FW:`

### Test 4: Subject Prefix
1. Reply to email with subject `Meeting`
2. **Expected**: New subject = `RE: Meeting`

### Test 5: No Double Prefix
1. Reply to `RE: Meeting`
2. **Expected**: Subject = `RE: Meeting` (not `RE: RE: Meeting`)

### Test 6: Quote Attribution
1. Reply to email
2. **Expected**: Original body quoted with attribution header

### Test 7: Forward Attachments
1. Forward email with attachments
2. **Expected**: Attachments included by default

### Test 8: Reply No Attachments
1. Reply to email with attachments
2. **Expected**: Attachments NOT included by default

### Test 9: Thread Headers
1. Reply to email
2. **Expected**: `In-Reply-To` and `References` headers set

---

## CARD-20: Priority Rule Engine

### Test 1: VIP Sender Priority
1. Add rule: `boss@company.com` → High priority
2. Receive email from boss
3. **Expected**: High priority badge

### Test 2: Keyword Priority
1. Add rule: subject contains `URGENT` → High priority
2. Receive email with `URGENT` in subject
3. **Expected**: High priority

### Test 3: Domain Priority
1. Add rule: `@client.com` → High priority
2. Receive email from `anyone@client.com`
3. **Expected**: High priority

### Test 4: Manual Override
1. Email auto-assigned Low priority
2. Manually set to High
3. **Expected**: Priority changes, persists

### Test 5: Rule Ordering
1. Create conflicting rules with different priorities
2. **Expected**: First matching rule wins

### Test 6: Regex Patterns
1. Add rule: subject matches `\[URGENT\]`
2. Receive email with `[URGENT]` in subject
3. **Expected**: Rule matches

### Test 7: Disable Rule
1. Disable a rule
2. **Expected**: Rule no longer matches

### Test 8: Performance
1. Process 100 emails with 10 rules each
2. **Expected**: Each evaluation < 5ms

---

## CARD-21: Priority UI Indicators

### Test 1: High Priority Badge
1. View email with High priority
2. **Expected**: Red badge displayed

### Test 2: Medium Priority Badge
1. View email with Medium priority
3. **Expected**: Yellow badge displayed

### Test 3: Low Priority Badge
1. View email with Low priority
2. **Expected**: Gray badge displayed

### Test 4: Priority Sorting
1. View inbox with mixed priorities
2. **Expected**: High → Medium → Low → Normal order

### Test 5: Date Sub-Sorting
1. View emails with same priority
2. **Expected**: Newest first within priority

### Test 6: Priority Filter
1. Filter to show only High priority
2. **Expected**: Only High priority emails visible

### Test 7: Priority Count
1. View inbox header
2. **Expected**: Shows count per priority level

### Test 8: Keyboard Shortcuts
1. Select email, press `H`
2. **Expected**: Priority set to High

### Test 9: Tooltip
1. Hover over priority badge
2. **Expected**: Shows matched rules

---

## CARD-22: Delta Sync Implementation

### Test 1: Initial Sync
1. First login with 100 emails
2. **Expected**: Full sync, delta token stored

### Test 2: Subsequent Sync
1. Wait for new email
2. Trigger sync
3. **Expected**: Only new email synced (fast)

### Test 3: No Changes
1. Sync when no new emails
2. **Expected**: Empty result, < 100ms

### Test 4: Modified Email
1. Mark email as read in Outlook
2. Sync
3. **Expected**: Email in `modified` array

### Test 5: Deleted Email
1. Delete email in Outlook
2. Sync
3. **Expected**: Email in `deleted` array

### Test 6: Token Expiration
1. Wait for token to expire (or simulate)
2. Sync
3. **Expected**: Falls back to full sync

### Test 7: Per-Folder Sync
1. Sync Inbox
2. Sync Sent Items
3. **Expected**: Separate tokens per folder

### Test 8: Concurrent Sync
1. Trigger sync from two tabs simultaneously
2. **Expected**: Only one sync runs, other waits

### Test 9: Progress Reporting
1. Sync with 500 new emails
2. **Expected**: Progress callback fires with percentage

### Test 10: Sync Failure
1. Simulate network error during sync
2. **Expected**: Old token preserved, can retry

---

## CARD-23: Role Detector Service

### Test 1: Sales Role Detection
1. Sign in with account having job title "Sales Manager"
2. View detected role in Settings
3. **Expected**: Role shows "Sales Professional" with high confidence

### Test 2: Executive Role Detection
1. Sign in with account having job title "VP of Sales"
2. View detected role
3. **Expected**: Role shows "Executive" with high confidence

### Test 3: Engineering Role Detection
1. Sign in with account having job title "Software Engineer"
2. View detected role
3. **Expected**: Role shows "Engineer" with high confidence

### Test 4: Unknown Role Detection
1. Sign in with account having job title "Mystery Role"
2. View detected role
3. **Expected**: Role shows "Professional" with low confidence

### Test 5: Department-Based Detection
1. Sign in with account in "Procurement" department
2. View detected role
3. **Expected**: Role shows "Purchasing Agent" with medium confidence

---

## CARD-24: Onboarding Agent Service

### Test 1: Start Onboarding
1. Clear user preferences
2. Trigger onboarding
3. **Expected**: Welcome message shows detected role

### Test 2: Role-Specific Questions (Sales)
1. Start onboarding as Sales role
2. View questions
3. **Expected**: Questions about customers, prospects, partners, vendors

### Test 3: Role-Specific Questions (Executive)
1. Start onboarding as Executive role
2. View questions
3. **Expected**: Questions about team, board, executives, media

### Test 4: Answer Submission
1. Start onboarding
2. Answer "Yes, push" to first question
3. **Expected**: Answer recorded, advances to next question

### Test 5: Onboarding Completion
1. Answer all onboarding questions
2. **Expected**: Summary screen with all rules displayed

### Test 6: Skip Onboarding
1. Start onboarding
2. Click "Skip"
3. **Expected**: Default rules applied, can re-run in Settings

### Test 7: Pre-filled Contacts
1. Have manager in Graph API
2. Start onboarding
3. **Expected**: Manager shown as pre-filled "always push" contact

---

## CARD-25: Relationship Context Provider

### Test 1: Manager Detection (CYA Rule)
1. Configure manager email in settings
2. Receive email from manager
3. **Expected**: Push decision returns "push" with reason "your_manager"

### Test 2: Executive Detection
1. Receive email from user with "VP" or "Chief" title
2. **Expected**: Push decision returns "push" with reason "executive"

### Test 3: Direct Report Detection
1. Have direct reports in Graph API
2. Receive email from direct report
3. **Expected**: Push decision includes team relationship

### Test 4: New Sender Prompt
1. Receive email from unknown sender
2. **Expected**: NewSenderPrompt created with suggested action

### Test 5: Internal vs External
1. Receive email from colleague@company.com
2. Receive email from vendor@external.com
3. **Expected**: Internal marked as "internal", external marked as "external"

### Test 6: Contact Context Retrieval
1. Receive email from known contact
2. View contact context
3. **Expected**: Shows relationship, company, push preference

---

## CARD-26: Sender Avatar Badges

### Test 1: Manager Badge
1. View email from your manager
2. **Expected**: Red badge with "Your Manager" label

### Test 2: Executive Badge
1. View email from executive (VP, C-level)
2. **Expected**: Purple badge with "Executive" label

### Test 3: Team Member Badge
1. View email from direct report
2. **Expected**: Blue badge with "Team Member" label

### Test 4: VIP Badge
1. Mark contact as VIP
2. View email from this contact
3. **Expected**: Yellow badge with "VIP" label

### Test 5: Customer Badge
1. Mark contact as customer
2. View email from this contact
3. **Expected**: Green badge with "Customer" label

### Test 6: No Badge for Unknown
1. View email from unknown external sender
2. **Expected**: No relationship badge displayed

### Test 7: Badge Tooltip
1. Hover over relationship badge
2. **Expected**: Shows relationship details

---

## CARD-27: Graph People API Integration

### Test 1: Fetch Relevant People
1. Trigger contact sync
2. **Expected**: People API returns relevance-ranked contacts

### Test 2: Relevance Score
1. View contacts list
2. **Expected**: Contacts sorted by relevance score (most relevant first)

### Test 3: Person Type Classification
1. View contact details
2. **Expected**: Shows personType (Person, Contact, etc.)

### Test 4: Job Title Extraction
1. Sync contacts
2. View contact with job title
3. **Expected**: Job title displayed in contact card

### Test 5: Department Extraction
1. Sync contacts
2. View contact with department
3. **Expected**: Department displayed in contact card

---

## CARD-28: Manager/Direct Reports API

### Test 1: Manager Fetch
1. Query Graph API for manager
2. **Expected**: Returns manager user object with job title

### Test 2: Direct Reports Fetch
1. Query Graph API for direct reports
2. **Expected**: Returns array of direct report user objects

### Test 3: Manager Email Match
1. Configure managerEmail in settings
2. Receive email from that address
3. **Expected**: Recognized as manager even without contact sync

### Test 4: Org Hierarchy Display
1. View organization section in contact details
2. **Expected**: Shows manager and direct reports

### Test 5: Executive Detection from Manager Chain
1. Manager reports to C-level
2. **Expected**: System aware of executive in reporting chain

---

## Test Results Template

| Card | Tests | Pass | Fail | Notes |
|------|-------|------|------|-------|
| 13 | 6 | | | |
| 14 | 7 | | | |
| 15 | 7 | | | |
| 16 | 6 | | | |
| 17 | 7 | | | |
| 18 | 6 | | | |
| 19 | 9 | | | |
| 20 | 8 | | | |
| 21 | 9 | | | |
| 22 | 10 | | | |
| 23 | 5 | | | Role Detection |
| 24 | 7 | | | Onboarding Agent |
| 25 | 6 | | | Relationship Context |
| 26 | 7 | | | Sender Badges |
| 27 | 5 | | | People API |
| 28 | 5 | | | Manager/Direct Reports |
| **Total** | **110** | | | |

---

## Sign-Off

- **Tester**: _______________
- **Date**: _______________
- **Build Version**: _______________
- **Environment**: _______________

### Issues Found
| Issue # | Card | Description | Severity |
|---------|------|-------------|----------|
| | | | |
| | | | |
| | | | |
