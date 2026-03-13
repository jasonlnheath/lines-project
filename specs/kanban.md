# Lines Project Kanban

## Phase 2: Contact Relationship Context (COMPLETE)

| Status | Card ID | Title | Description |
|--------|---------|-------|-------------|
| ✅ | CARD-23 | Role Detector Service | Detect user role from Graph API (12 roles) |
| ✅ | CARD-24 | Onboarding Agent Service | Role-based question templates, no manual tags |
| ✅ | CARD-25 | Relationship Context Provider | Push decisions with CYA rules |
| ✅ | CARD-26 | Sender Avatar Badges | Relationship badges (manager, executive, VIP) |
| ✅ | CARD-27 | Graph People API Integration | Fetch relevance-ranked contacts |
| ✅ | CARD-28 | Manager/Direct Reports API | Org hierarchy detection |

---

## Phase 3: Contact Sync (Email + iOS)

| Status | Card ID | Title | Description | Priority |
|--------|---------|-------|-------------|----------|
| ⬜ | CARD-31 | iOS Contacts Permission | Request iOS contacts access | High |
| ⬜ | CARD-32 | iOS Contacts Fetch | Import contacts from iOS Contacts app | High |
| ⬜ | CARD-33 | iOS Contact Mapping | Map iOS contact fields to Contact model | High |
| ⬜ | CARD-34 | Outlook Contacts Sync | Sync contacts from Outlook via Graph API | High |
| ⬜ | CARD-35 | Contact Merge Logic | Dedupe contacts from multiple sources | Medium |
| ⬜ | CARD-36 | Contact Sync Scheduler | Background sync (hourly/daily) | Medium |
| ⬜ | CARD-37 | Contact Change Detection | Delta sync for contacts | Medium |
| ⬜ | CARD-38 | Company Name Extraction | Parse company from email domain | Low |
| ⬜ | CARD-39 | Contact UI - List View | Browse all contacts with search | Medium |
| ⬜ | CARD-40 | Contact UI - Detail View | View contact with push preference | Medium |

---

## Phase 4: Simplified Push/Pull Rules

| Status | Card ID | Title | Description | Priority |
|--------|---------|-------|-------------|----------|
| ⬜ | CARD-41 | Domain Rules Engine | Push/pull by company domain | High |
| ⬜ | CARD-42 | Category Rules | Push/pull by contact category | High |
| ⬜ | CARD-43 | Rules UI - Settings | Manage domain/category rules | High |
| ⬜ | CARD-44 | Rules Conflict Resolution | Handle overlapping rules | Medium |
| ⬜ | CARD-45 | Rule Priority System | Order of evaluation | Medium |
| ⬜ | CARD-46 | Bulk Rule Import | Import rules from CSV | Low |
| ⬜ | CARD-47 | Rule Templates | Pre-built rules by role | Medium |
| ⬜ | CARD-48 | Rule Analytics | Track rule effectiveness | Low |

---

## Phase 5: Agent Onboarding UI

| Status | Card ID | Title | Description | Priority |
|--------|---------|-------|-------------|----------|
| ⬜ | CARD-51 | Onboarding Welcome Screen | Show detected role + description | High |
| ⬜ | CARD-52 | Onboarding Question Flow | Display questions, collect answers | High |
| ⬜ | CARD-53 | Onboarding Progress Bar | Show question X of Y | Medium |
| ⬜ | CARD-54 | CYA Contact Display | Show manager/executives pre-filled | High |
| ⬜ | CARD-55 | Onboarding Summary Screen | Final rules summary before save | High |
| ⬜ | CARD-56 | Skip Onboarding | Allow skipping with defaults | Medium |
| ⬜ | CARD-57 | Re-run Onboarding | Settings option to restart | Low |
| ⬜ | CARD-58 | Onboarding Analytics | Track completion rates | Low |
| ⬜ | CARD-59 | Role Correction UI | Allow user to change detected role | Medium |
| ⬜ | CARD-60 | Onboarding Help Tooltips | Explain push/pull concepts | Low |

---

## Status Legend

| Icon | Status |
|------|--------|
| ⬜ | Todo |
| 🔄 | In Progress |
| ✅ | Complete |
| ⏸️ | Blocked |
| ❌ | Cancelled |

---

## Phase Summary

| Phase | Cards | Complete | In Progress | Todo |
|-------|-------|----------|-------------|------|
| Phase 2 | 6 | 6 | 0 | 0 |
| Phase 3 | 10 | 0 | 0 | 10 |
| Phase 4 | 8 | 0 | 0 | 8 |
| Phase 5 | 10 | 0 | 0 | 10 |
| **Total** | **34** | **6** | **0** | **28** |

---

## Dependencies

```
Phase 3 (Contact Sync)
    ├── CARD-31 (iOS Permission) → CARD-32 (iOS Fetch)
    ├── CARD-32 (iOS Fetch) → CARD-33 (Mapping)
    ├── CARD-34 (Outlook Sync) → CARD-35 (Merge)
    └── CARD-35 (Merge) → CARD-36 (Scheduler)

Phase 4 (Rules)
    ├── CARD-41 (Domain Rules) → CARD-43 (Rules UI)
    ├── CARD-42 (Category Rules) → CARD-43 (Rules UI)
    └── CARD-43 (Rules UI) → CARD-44 (Conflict)

Phase 5 (Onboarding UI)
    ├── CARD-51 (Welcome) → CARD-52 (Question Flow)
    ├── CARD-52 (Questions) → CARD-55 (Summary)
    └── CARD-54 (CYA Display) → CARD-55 (Summary)
```

---

## Notes

- Phase 2 backend services are complete
- Phase 2 UI components (SenderAvatar) have relationship badges
- Phase 2 needs manual testing before proceeding to Phase 3
- Phase 5 onboarding UI depends on Phase 2 agent services (already done)
