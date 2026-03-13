# MVP Feature Checklist

## Core MVP Features (Must Have)

### Authentication & Sync
- [ ] Microsoft Graph OAuth 2.0 authentication
- [ ] Token refresh and management
- [ ] Multi-account support (future)
- [ ] Initial email sync (full mailbox)
- [ ] Incremental sync via delta queries
- [ ] Offline caching (download on receive, present on pull)

### Push/Pull Inbox System
- [ ] Default pull behavior (messages wait silently)
- [ ] Auto-push triggers:
  - [ ] Importance flag (!) + direct recipient (not CC)
  - [ ] Angry boss detection (red tone from manager)
  - [ ] Time-sensitive keywords + direct recipient
  - [ ] User-designated VIP senders
- [ ] Progressive disclosure onboarding
  - [ ] New sender → ask push/pull preference
  - [ ] New subject → ask push/pull preference
  - [ ] Show settings location
- [ ] User-defined push rules (sender, subject, combination)

### Priority System
- [ ] Three-tier priority (High/Medium/Low)
- [ ] Sender-based priority rules
- [ ] Subject keyword priority rules
- [ ] Manual priority override
- [ ] Priority persistence across sessions

### Agent-Based Search
- [ ] Natural language query interface
- [ ] Core tools implementation:
  - [ ] `read` - Full message content
  - [ ] `grep` - Pattern matching across messages
  - [ ] `glob` - Filename/subject patterns
  - [ ] `fetch` - Retrieve threads/related messages
  - [ ] `summarize` - Content condensation
- [ ] Query result explanation
- [ ] Context-aware responses

### Email Operations
- [ ] View inbox with priority sorting
- [ ] Read individual emails
- [ ] Basic compose
- [ ] Reply/Reply All
- [ ] Forward
- [ ] Rich text formatting
- [ ] Attachment viewing

### Tone Analysis
- [ ] Incoming message tone classification
- [ ] Visual indicators (green/yellow/red)
- [ ] Sender baseline calibration
- [ ] Thread tone trajectory tracking

### Archive System
- [ ] Export email to structured markdown
- [ ] YAML frontmatter with metadata
- [ ] OneDrive folder selection
- [ ] Automatic folder organization (year/quarter/month)
- [ ] Archive index for fast search

### Attachment Management
- [ ] View attachments in email
- [ ] Save attachment to OneDrive
- [ ] User-specified OneDrive folder
- [ ] Auto-sync to work PC via OneDrive
- [ ] Attachment version timeline
- [ ] Include attachments in archive

### Context Memory
- [ ] 24-hour context retention
- [ ] Subject-based handoff files
- [ ] Conversation summarization
- [ ] Reference earlier messages in new replies

### Contact Relationship Context (Phase 2 - DONE)
- [x] Microsoft Graph People API integration
- [x] Microsoft Graph Manager/Direct Reports API
- [x] Role detection from job title/department (12 roles)
- [x] Agent-driven onboarding (NO manual tags)
- [x] CYA (Cover Your Ass) rules - manager, executives always push
- [x] Role-specific question templates
- [x] Push/pull preference system
- [x] Progressive disclosure for new senders
- [x] Relationship badges in UI (manager, executive, team, VIP, customer)
- [ ] iOS Contacts integration (Phase 3)
- [ ] Contact sync from Outlook (Phase 3)

## V1.1 Features (Post-MVP)

### Hands-Free Mode
- [ ] Voice activation ("Pull my emails")
- [ ] Email summary reading
- [ ] Full email reading
- [ ] Thread summarization
- [ ] Voice response dictation
- [ ] Tone adjustment ("make it more formal")
- [ ] Send confirmation by voice
- [ ] Attachment handling (read/summarize)
- [ ] CarPlay detection

### Siri Integration
- [ ] Siri shortcuts for common actions
- [ ] "Check my emails" intent
- [ ] "Read urgent emails" intent
- [ ] Custom shortcuts for contacts

### Response Screening
- [ ] Pre-send tone analysis
- [ ] Frustration detection alert
- [ ] Completeness checking
- [ ] Missing question detection
- [ ] Quality scoring (A-F)
- [ ] Improvement suggestions

### Recipient Analysis
- [ ] Unnecessary CC detection
- [ ] Missing recipient suggestions
- [ ] To: field alphabetical sorting
- [ ] Seniority ordering option

### Thread Intelligence
- [ ] Thread reconstruction
- [ ] Timeline view visualization
- [ ] Branch detection
- [ ] Subject line mutation tracking

### Microsoft Integration
- [ ] Calendar event creation from email
- [ ] Meeting scheduling assistance
- [ ] Contact lookup
- [ ] Teams meeting creation

### Context Aggregation Framework
- [ ] Multi-channel context ingestion
  - [ ] Email (Microsoft Graph) - DONE
  - [ ] Teams messages
  - [ ] Teams meeting transcripts
  - [ ] SMS/iMessage (iOS limited)
  - [ ] Phone call notes (manual entry)
- [ ] Model-agnostic tool architecture
  - [ ] Context fetchers independent of LLM choice
  - [ ] Standardized context schema
  - [ ] Tool registry for pluggable context sources
- [ ] Meeting Intelligence
  - [ ] Teams auto-transcription integration
  - [ ] Meeting minutes auto-generation
  - [ ] Action item extraction
  - [ ] Follow-up email drafting from meeting notes

## V1.2+ Features (Future)

### Extended Context
- [ ] Week-long context retention
- [ ] Month-long context retention
- [ ] Relationship mapping
- [ ] Project timeline tracking

### Puzzle-Piece Thread Clustering
- [ ] Confidence interval visualization
  - [ ] Show similarity score on thread suggestions
  - [ ] Visual fit indicator (good fit / partial fit / poor fit)
- [ ] Interactive cluster assembly
  - [ ] "Try this piece" mode - preview how thread fits
  - [ ] A/B comparison of cluster configurations
  - [ ] User decision tracking for learning
- [ ] Outlook round-trip
  - [ ] Push confirmed thread connections to Outlook
  - [ ] Create conversation categories in Outlook
  - [ ] Sync thread groups across devices

### AI Compose
- [ ] Draft generation
- [ ] Tone matching
- [ ] Professional rewording
- [ ] Grammar correction

### Additional Channels
- [ ] Gmail support
- [ ] SMS integration (iOS limited)
- [ ] SMS integration (Android)
- [ ] Phone call screening
- [ ] Voicemail transcription

### Platform Expansion
- [ ] Android version
- [ ] Desktop app (Mac/Windows)
- [ ] Web app

## Definition of Done

Each feature is complete when:
1. Functional requirements met
2. Unit tests passing
3. Integration tests passing
4. Code reviewed
5. Documentation updated
6. Tested on 2+ iOS versions
7. Tested on 2+ device sizes
8. Security review completed (if applicable)
