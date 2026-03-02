# Lines - Unified Communication Management Platform

## Project Overview

**Lines** is a unified communication management platform that connects all channels of communication into a single, intelligent interface. Starting with Microsoft Outlook/365 on iOS, Lines introduces revolutionary features:

- **Push/Pull Hybrid Inbox** - Users pull messages on their terms, with intelligent push for truly urgent communications
- **Agent-Based Search** - Natural language queries powered by intelligent tools (grep, glob, read, fetch)
- **Hands-Free Driving Mode** - Complete voice-driven email management
- **Response Screening** - Pre-send tone and completeness checking
- **Tone Analysis** - Visual indicators (green/yellow/red) for emotional state
- **OneDrive Integration** - Archive emails, save attachments, sync across devices

## Quick Start for Claude Code

### Option 1: Direct Import

1. Copy the entire `lines-project` folder to your local machine
2. Open Claude Code in that directory
3. The specification is in `docs/Lines_Product_Specification_v4.docx`
4. Research files are in `research/`
5. Project structure template is in `specs/`

### Option 2: Start Fresh

```bash
# Create project directory
mkdir lines-app
cd lines-app

# Initialize with your preferred stack
# For React Native + Expo:
npx create-expo-app@latest . --template blank-typescript

# For Next.js (if starting with web prototype):
npx create-next-app@latest . --typescript --tailwind --app
```

## Project Structure

```
lines-project/
├── README.md                    # This file
├── docs/
│   └── Lines_Product_Specification_v4.docx  # Complete product spec
├── research/
│   ├── research_ios_calls.json           # iOS CallKit research
│   ├── research_ios_sms.json             # iOS SMS filtering research
│   ├── research_ios_voicemail.json       # iOS voicemail access research
│   ├── research_ios_call_limits.json     # iOS call extension limits
│   ├── research_android_sms.json         # Android SMS/Call API research
│   ├── research_call_apps.json           # Truecaller/Hiya analysis
│   └── research_voicemail_workaround.json # Voicemail solutions
├── specs/
│   ├── mvp-features.md                   # MVP feature checklist
│   ├── technical-architecture.md         # Architecture decisions
│   └── api-reference.md                  # API documentation template
└── src/
    └── (placeholder for future code)
```

## Development Setup Requirements

### For iOS Development (Mac Required)

1. **Xcode** (latest from Mac App Store)
   ```bash
   xcode-select --install
   ```

2. **Node.js & Package Manager**
   ```bash
   # Using Homebrew
   brew install node
   # or install bun
   brew install oven-sh/bun/bun
   ```

3. **Expo CLI**
   ```bash
   npm install -g expo-cli
   ```

4. **Apple Developer Account**
   - Sign up at developer.apple.com ($99/year)
   - Required for TestFlight and App Store distribution

5. **Microsoft Azure App Registration**
   - Go to portal.azure.com
   - Register new application for Microsoft Graph API access
   - Configure OAuth redirect URIs
   - Note: Application (client) ID and tenant ID

### For Prototype/POC (Any Platform)

1. **Claude Code** with your preferred AI model
2. **z-ai-web-dev-sdk** (already available in this environment)
3. **Supabase account** (free tier) for backend prototype

## Key API Credentials Needed

| Service | Purpose | Where to Get |
|---------|---------|--------------|
| Microsoft Graph API | Email, Calendar, OneDrive | Azure Portal |
| Supabase | Database, Auth | supabase.com |
| Claude API | Agent intelligence | anthropic.com |
| OpenAI API | Alternative LLM | platform.openai.com |

## MVP Feature Checklist

See `specs/mvp-features.md` for complete breakdown. Core MVP:

- [ ] Microsoft Graph OAuth authentication
- [ ] Email sync with offline caching
- [ ] Push/Pull hybrid inbox
- [ ] Priority system with user rules
- [ ] Agent-based search (read, grep, glob, fetch)
- [ ] Basic compose/reply
- [ ] Tone indicators
- [ ] Archive export to OneDrive
- [ ] Attachment save to user-specified OneDrive folder
- [ ] Context memory (24hr)

## Timeline Estimate

**MVP: 21-29 weeks (~5-7 months)**

| Phase | Duration |
|-------|----------|
| Research & Planning | 3-4 weeks |
| Backend Core | 4-5 weeks |
| iOS App Core | 5-6 weeks |
| Agent Tools | 3-4 weeks |
| Tone & Priority | 2-3 weeks |
| Testing & Polish | 3-4 weeks |
| App Store | 1-3 weeks |

## Next Immediate Steps

1. **Set up Azure App Registration** for Microsoft Graph API
2. **Create Supabase project** for backend infrastructure
3. **Build agent search POC** using Claude Code + GLM
4. **Research tone analysis projects** on GitHub
5. **Test OneDrive API** for attachment save feature

## Important Notes

- This specification is a living document - update as you learn
- Start with POC before committing to full mobile build
- Microsoft Graph API has generous rate limits for business accounts
- OneDrive sync is native to Windows 10/11 - saved files appear automatically

## Contact & Version

- **Version:** 4.0
- **Last Updated:** March 2025
- **Status:** Planning Phase
