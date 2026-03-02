# Lines Project Setup Guide

## What's Included

You've downloaded the complete Lines project bundle containing:

```
lines-project/
├── README.md                          # Project overview & quick start
├── docs/
│   └── Lines_Product_Specification_v4.docx  # Complete product spec
├── specs/
│   ├── mvp-features.md                # Feature checklist
│   ├── technical-architecture.md      # Architecture decisions
│   └── api-reference.md               # API documentation template
├── research/
│   ├── RESEARCH_SUMMARY.md            # Key findings
│   ├── research_ios_calls.json        # iOS CallKit research
│   ├── research_ios_sms.json          # iOS SMS filtering
│   ├── research_ios_voicemail.json    # Voicemail access
│   ├── research_android_sms.json      # Android capabilities
│   └── ... (more research files)
└── src/                               # (placeholder for code)
```

## Setting Up in Claude Code

### Step 1: Extract the Files
Download and extract `lines-project.zip` to your preferred location.

### Step 2: Open in Claude Code
```bash
cd lines-project
claude  # or your Claude Code command
```

### Step 3: Start with the Spec
Point Claude Code to the specification:
```
"Read docs/Lines_Product_Specification_v4.docx and help me understand the architecture"
```

### Step 4: Begin with Research
```
"Review research/RESEARCH_SUMMARY.md and help me plan the next steps"
```

## Development Path Options

### Option A: Prototype First (Recommended)
Build a web-based prototype to test agent search:
1. Create Next.js app for prototype
2. Implement agent search with GLM/Claude
3. Test OneDrive integration
4. Validate before mobile development

### Option B: Mobile First
Jump straight into React Native:
1. Install Xcode (Mac required)
2. Initialize Expo project
3. Set up Microsoft Graph API
4. Build core features

### Option C: Backend First
Build the infrastructure:
1. Create Supabase project
2. Set up Microsoft Azure app registration
3. Implement sync service
4. Then build mobile

## Required Accounts

| Service | Purpose | Cost |
|---------|---------|------|
| Microsoft Azure | Graph API access | Free tier available |
| Apple Developer | iOS App Store | $99/year |
| Supabase | Database/Auth | Free tier available |
| Anthropic/Claude | Agent intelligence | Pay per use |

## Immediate Next Steps

1. **Read the spec** - Open Lines_Product_Specification_v4.docx
2. **Set up Azure** - Register app for Microsoft Graph API
3. **Choose your path** - Prototype, mobile, or backend first
4. **Start building** - Use Claude Code to accelerate development

## Key Files to Read First

1. `README.md` - Project overview
2. `docs/Lines_Product_Specification_v4.docx` - Complete specification
3. `specs/mvp-features.md` - What to build first
4. `research/RESEARCH_SUMMARY.md` - Platform capabilities

## Questions for Claude Code

Once set up, you can ask Claude Code:
- "Help me set up a Microsoft Azure app registration"
- "Create a prototype for agent-based email search"
- "Generate the database schema for the context memory system"
- "Build a proof-of-concept for the tone analysis feature"

---

**Version:** 4.0
**Status:** Ready for development
**Next:** Choose your development path and begin!
