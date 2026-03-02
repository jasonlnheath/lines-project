const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, 
        Header, Footer, AlignmentType, LevelFormat, TableOfContents, HeadingLevel, 
        BorderStyle, WidthType, ShadingType, VerticalAlign, PageNumber, PageBreak } = require('docx');
const fs = require('fs');

const colors = { primary: "020617", bodyText: "1E293B", secondary: "64748B", accent: "94A3B8", tableBg: "F8FAFC" };
const tableBorder = { style: BorderStyle.SINGLE, size: 12, color: colors.primary };
const cellBorders = { top: tableBorder, bottom: tableBorder, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } };

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Times New Roman", size: 24 } } },
    paragraphStyles: [
      { id: "Title", name: "Title", basedOn: "Normal", run: { size: 72, bold: true, color: colors.primary, font: "Times New Roman" }, paragraph: { spacing: { before: 0, after: 200 }, alignment: AlignmentType.CENTER } },
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 36, bold: true, color: colors.primary, font: "Times New Roman" }, paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 28, bold: true, color: colors.bodyText, font: "Times New Roman" }, paragraph: { spacing: { before: 300, after: 150 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 24, bold: true, color: colors.secondary, font: "Times New Roman" }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } }
    ]
  },
  numbering: {
    config: [
      { reference: "bullet", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "num1", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "num2", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "num3", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "num4", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }
    ]
  },
  sections: [
    // Cover
    { properties: { page: { margin: { top: 0, right: 0, bottom: 0, left: 0 } } }, children: [
      new Paragraph({ spacing: { before: 3500 }, children: [] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "LINES", font: "Times New Roman", size: 120, bold: true, color: colors.primary })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [new TextRun({ text: "Product Specification Document", font: "Times New Roman", size: 36, italics: true, color: colors.secondary })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 100 }, children: [new TextRun({ text: "Unified Communication Management Platform", font: "Times New Roman", size: 28, color: colors.bodyText })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100, after: 100 }, children: [new TextRun({ text: "Version 4.0 - Complete Specification with OneDrive Integration", font: "Times New Roman", size: 24, color: colors.accent })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 2500 }, children: [new TextRun({ text: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), font: "Times New Roman", size: 22, color: colors.accent })] }),
      new Paragraph({ children: [new PageBreak()] })
    ]},
    // Content
    { properties: { page: { margin: { top: 1800, right: 1440, bottom: 1440, left: 1440 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Lines Product Specification v4.0", font: "Times New Roman", size: 20, color: colors.secondary, italics: true })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Page ", font: "Times New Roman", size: 20 }), new TextRun({ children: [PageNumber.CURRENT], font: "Times New Roman", size: 20 }), new TextRun({ text: " of ", font: "Times New Roman", size: 20 }), new TextRun({ children: [PageNumber.TOTAL_PAGES], font: "Times New Roman", size: 20 })] })] }) },
      children: [
        new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 400 }, children: [new TextRun({ text: "Note: Right-click TOC and select 'Update Field' to refresh page numbers.", font: "Times New Roman", size: 18, color: colors.accent, italics: true })] }),
        new Paragraph({ children: [new PageBreak()] }),

        // 1. Executive Summary
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("1. Executive Summary")] }),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("1.1 Product Identity")] }),
        new Paragraph({ spacing: { after: 150 }, children: [new TextRun({ text: "Product Name: ", bold: true }), new TextRun("Lines")] }),
        new Paragraph({ spacing: { after: 150 }, children: [new TextRun({ text: "Tagline: ", bold: true }), new TextRun({ text: "\"All your lines of communication, unified.\"", italics: true })] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "Initial Market Focus: ", bold: true }), new TextRun("Business professionals using Microsoft 365/Outlook on iOS devices. Lines reimagines email as an intelligent, agent-powered communication hub where users control when and how they engage with their messages through a revolutionary pull-based inbox system combined with intelligent push notifications for truly urgent communications.")] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("1.2 Key Differentiators")] }),
        new Paragraph({ numbering: { reference: "num1", level: 0 }, children: [new TextRun({ text: "Push/Pull Hybrid Inbox: Intelligent notification system that pushes only truly urgent messages while user pulls everything else on their own terms." })] }),
        new Paragraph({ numbering: { reference: "num1", level: 0 }, children: [new TextRun({ text: "Agent-Based Search: Natural language queries powered by tools like grep, glob, read, and fetch—transforming email search from keyword matching to intelligent understanding." })] }),
        new Paragraph({ numbering: { reference: "num1", level: 0 }, children: [new TextRun({ text: "Hands-Free Driving Mode: Complete voice-driven email management for safe productivity while commuting." })] }),
        new Paragraph({ numbering: { reference: "num1", level: 0 }, children: [new TextRun({ text: "Response Screening: Pre-send analysis that catches frustration, incomplete responses, and offers quality scoring." })] }),
        new Paragraph({ numbering: { reference: "num1", level: 0 }, children: [new TextRun({ text: "Tone Analysis: Visual indicators (green/yellow/red) showing emotional state of messages." })] }),
        new Paragraph({ numbering: { reference: "num1", level: 0 }, children: [new TextRun({ text: "OneDrive Deep Integration: Archive emails, save attachments to user-specified folders, auto-sync to work PC." })] }),
        new Paragraph({ numbering: { reference: "num1", level: 0 }, spacing: { after: 200 }, children: [new TextRun({ text: "Microsoft Ecosystem Integration: Native support for Outlook, Teams, Calendar, Contacts through Microsoft Graph API." })] }),

        // 2. Push/Pull System
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("2. Push/Pull Hybrid Inbox System")] }),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.1 Core Behavior")] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun("The default behavior in Lines is pull-based: messages arrive silently and wait for the user to actively retrieve them. This fundamental shift puts the user in control of their attention. However, certain conditions trigger push notifications to ensure critical communications are never missed.")] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.2 Automatic Push Triggers")] }),
        new Paragraph({ spacing: { after: 150 }, children: [new TextRun("Messages automatically trigger push notification when any of the following conditions are met:")] }),
        new Paragraph({ numbering: { reference: "bullet", level: 0 }, children: [new TextRun({ text: "Importance Flag + Direct Recipient: Email flagged with high importance (!) AND user is in the To: field (not CC'd)" })] }),
        new Paragraph({ numbering: { reference: "bullet", level: 0 }, children: [new TextRun({ text: "Angry Boss Detection: Tone analysis detects red-level frustration from a sender identified as a manager or superior" })] }),
        new Paragraph({ numbering: { reference: "bullet", level: 0 }, children: [new TextRun({ text: "Time-Sensitive Language: Keywords like \"urgent,\" \"ASAP,\" \"time-sensitive\" combined with direct recipient status" })] }),
        new Paragraph({ numbering: { reference: "bullet", level: 0 }, spacing: { after: 200 }, children: [new TextRun({ text: "User-Designated VIP Senders: Specific people the user has marked for push notification regardless of content" })] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.3 Progressive Disclosure Onboarding")] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun("New users are guided through preference setting through an elegant progressive disclosure system. When the first email arrives from a new sender, Lines presents a brief prompt asking the user's push/pull preference for emails from this person. The user can choose: Always Push, Always Pull, or Ask Me Later. After initial setup, Lines shows where in the interface they can modify settings at any time. This builds the user's rule set organically over time.")] }),

        // 3. OneDrive Integration
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("3. OneDrive Integration & Attachment Management")] }),
        
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3.1 Overview")] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun("OneDrive serves as the primary cloud infrastructure for Lines, providing seamless integration with the Microsoft 365 ecosystem that business users already rely on. This integration enables powerful workflows: saved attachments automatically sync to work PCs, archives are accessible from any device, and the familiar OneDrive folder structure provides intuitive organization.")] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3.2 Save Attachment to OneDrive Feature")] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun("The Save Attachment feature allows users to save email attachments directly to OneDrive folders they specify, with automatic sync to their work PC. This workflow transforms how professionals handle email attachments, eliminating the download-upload-transfer cycle that wastes time and creates version confusion.")] }),

        new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("3.2.1 User Workflow")] }),
        new Paragraph({ numbering: { reference: "num2", level: 0 }, children: [new TextRun({ text: "User opens email with attachment in Lines" })] }),
        new Paragraph({ numbering: { reference: "num2", level: 0 }, children: [new TextRun({ text: "User taps \"Save to OneDrive\" button on attachment" })] }),
        new Paragraph({ numbering: { reference: "num2", level: 0 }, children: [new TextRun({ text: "Lines displays folder picker showing OneDrive structure" })] }),
        new Paragraph({ numbering: { reference: "num2", level: 0 }, children: [new TextRun({ text: "User navigates to desired folder (or creates new folder)" })] }),
        new Paragraph({ numbering: { reference: "num2", level: 0 }, children: [new TextRun({ text: "User confirms save location" })] }),
        new Paragraph({ numbering: { reference: "num2", level: 0 }, children: [new TextRun({ text: "Lines uploads attachment via Microsoft Graph API" })] }),
        new Paragraph({ numbering: { reference: "num2", level: 0 }, children: [new TextRun({ text: "File appears in OneDrive folder on work PC within seconds (auto-sync)" })] }),
        new Paragraph({ numbering: { reference: "num2", level: 0 }, spacing: { after: 200 }, children: [new TextRun({ text: "Lines records path in archive index for future reference" })] }),

        new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("3.2.2 Default Folder Configuration")] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun("Users can configure a default save location to streamline the workflow. In Settings, users specify their preferred attachment folder (e.g., \"/Work Documents/Email Attachments\" or \"/Project Files\"). When saving an attachment, this folder is pre-selected, reducing the interaction to a single tap for most saves. Users can still navigate to other folders when needed.")] }),

        new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("3.2.3 Folder Organization Options")] }),
        new Paragraph({ spacing: { after: 150 }, children: [new TextRun("Lines offers several automatic organization options for saved attachments:")] }),
        new Paragraph({ numbering: { reference: "bullet", level: 0 }, children: [new TextRun({ text: "By Date: Organize into year/month subfolders (2025/January/)" })] }),
        new Paragraph({ numbering: { reference: "bullet", level: 0 }, children: [new TextRun({ text: "By Sender: Organize into sender-named folders (John Smith/)" })] }),
        new Paragraph({ numbering: { reference: "bullet", level: 0 }, children: [new TextRun({ text: "By Project: Auto-detect project names from email subjects" })] }),
        new Paragraph({ numbering: { reference: "bullet", level: 0 }, spacing: { after: 200 }, children: [new TextRun({ text: "Flat: All attachments in selected folder (user manages organization)" })] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3.3 Attachment Version Timeline")] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun("When multiple versions of an attachment exist (similar filenames or repeated sends), Lines builds a visual timeline showing each version with date, sender, and cover email notes. Users can select which version to save, or request a diff analysis: \"What changed between version 2 and version 3?\" This feature integrates with the \"Which version is current?\" agent query, where Lines identifies the most recent version marked as \"final\" or \"approved.\"")] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3.4 Archive System with Attachments")] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun("The email archive system fully includes attachments. When archiving an email, Lines saves both the structured markdown file and all attachments to OneDrive. Large attachments (over 25MB) are stored with a reference file containing the OneDrive sharing link, while the actual file is stored in a dedicated attachments folder. The markdown archive file includes a reference to each attachment with its path, size, type, and a brief auto-generated description.")] }),

        new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("3.4.1 Archive Folder Structure")] }),
        new Paragraph({ spacing: { after: 200 }, shading: { fill: "F5F5F5", type: ShadingType.CLEAR }, children: [new TextRun({ text: "/Lines Archive/\n├── 2025/\n│   ├── Q1/\n│   │   ├── January/\n│   │   │   ├── 2025-01-15_john-smith_budget-review.md\n│   │   │   └── 2025-01-16_sarah-jones_project-update.md\n│   │   └── February/\n│   └── Q2/\n└── Attachments/\n    └── 2025/\n        └── Q1/\n            ├── budget_v3_john-smith.xlsx\n            └── project-plan_sarah-jones.pdf", font: "Courier New", size: 18 })] }),

        // 4. Agent-Based Search
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("4. Agent-Based Search Architecture")] }),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("4.1 Tool Set")] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun("The agent search system operates with a carefully selected toolkit: read (examine full message content), grep (pattern matching across messages), glob (pattern matching for subjects/filenames), fetch (retrieve related messages/threads), summarize (condense content), analyze_tone (evaluate emotional content), extract (pull structured data), and diff (compare document versions).")] }),

        // 5. Hands-Free Mode
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("5. Hands-Free & Driving Mode")] }),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("5.1 Voice Workflow")] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun("Lines includes a comprehensive hands-free mode for driving or any situation where eyes and hands need to remain free. The workflow includes: Pull initiation (\"Pull my emails\"), summary presentation, deep dive options, response workflow with draft or dictate options, tone adjustment, and send confirmation—all by voice. Attachments are handled intelligently: short documents can be read verbatim, long documents are summarized, and images can be described or saved for later viewing.")] }),

        // 6. Response Screening
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("6. Response Screening System")] }),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("6.1 Pre-Send Analysis")] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun("Lines analyzes outgoing emails before sending to prevent common mistakes. Tone detection alerts if frustration is detected: \"I sense frustration in your tone. Is this intentional?\" Completeness checking ensures all questions are addressed. Quality scoring provides a letter grade with improvement suggestions. Recipient analysis suggests additions or removals from the thread. This feature transforms Lines from a communication tool into a communication coach.")] }),

        // 7. Context Memory
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("7. Context Memory System")] }),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("7.1 Implementation Strategy")] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun("Lines implements a hybrid context system combining subject-based handoff files (key entities, decisions, commitments), context trees for complex threads, summarization compaction for size management, and active session context for immediate coherence. This provides robust context maintenance across days, weeks, and months of ongoing conversations.")] }),

        // 8. Technical Architecture
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("8. Technical Architecture")] }),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("8.1 Mobile Stack")] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun("React Native with Expo for cross-platform development. Pencil (shadcn-based) for UI components. SQLite for local caching. Native Swift modules for iOS-specific features including Siri integration and background processing.")] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("8.2 Offline Capability")] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun("All emails are downloaded to device when received but not presented until user pulls them. Users can pull emails, search archives, and manage priorities even without network connectivity. Changes made offline are queued and synchronized when connectivity returns.")] }),

        // 9. Development Requirements
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("9. Development Requirements")] }),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("9.1 Mac Development Setup")] }),
        new Paragraph({ spacing: { after: 150 }, children: [new TextRun("Development of Lines for iOS requires:")] }),
        new Paragraph({ numbering: { reference: "bullet", level: 0 }, children: [new TextRun({ text: "Xcode (latest from Mac App Store)" })] }),
        new Paragraph({ numbering: { reference: "bullet", level: 0 }, children: [new TextRun({ text: "Node.js and npm/bun" })] }),
        new Paragraph({ numbering: { reference: "bullet", level: 0 }, children: [new TextRun({ text: "Expo CLI" })] }),
        new Paragraph({ numbering: { reference: "bullet", level: 0 }, children: [new TextRun({ text: "Apple Developer account ($99/year)" })] }),
        new Paragraph({ numbering: { reference: "bullet", level: 0 }, spacing: { after: 200 }, children: [new TextRun({ text: "Microsoft Azure App Registration for Graph API" })] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("9.2 Testing Options")] }),
        new Paragraph({ numbering: { reference: "bullet", level: 0 }, children: [new TextRun({ text: "Xcode Simulator: Free testing on virtual iOS devices" })] }),
        new Paragraph({ numbering: { reference: "bullet", level: 0 }, children: [new TextRun({ text: "TestFlight: Distribute to 10,000 beta testers" })] }),
        new Paragraph({ numbering: { reference: "bullet", level: 0 }, children: [new TextRun({ text: "Development devices: Direct installation for testing" })] }),
        new Paragraph({ numbering: { reference: "bullet", level: 0 }, spacing: { after: 200 }, children: [new TextRun({ text: "Expo Go: Rapid iteration without full builds" })] }),

        // 10. MVP Scope
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("10. MVP Scope Definition")] }),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("10.1 MVP Features")] }),
        new Paragraph({ numbering: { reference: "num3", level: 0 }, children: [new TextRun({ text: "Microsoft Graph Authentication with OAuth" })] }),
        new Paragraph({ numbering: { reference: "num3", level: 0 }, children: [new TextRun({ text: "Email Sync with offline caching" })] }),
        new Paragraph({ numbering: { reference: "num3", level: 0 }, children: [new TextRun({ text: "Push/Pull Hybrid Inbox with progressive disclosure onboarding" })] }),
        new Paragraph({ numbering: { reference: "num3", level: 0 }, children: [new TextRun({ text: "Priority System with user-defined rules" })] }),
        new Paragraph({ numbering: { reference: "num3", level: 0 }, children: [new TextRun({ text: "Agent-Based Search with core tools (read, grep, glob, fetch, summarize)" })] }),
        new Paragraph({ numbering: { reference: "num3", level: 0 }, children: [new TextRun({ text: "Basic Compose/Reply" })] }),
        new Paragraph({ numbering: { reference: "num3", level: 0 }, children: [new TextRun({ text: "Tone Indicators on messages" })] }),
        new Paragraph({ numbering: { reference: "num3", level: 0 }, children: [new TextRun({ text: "Archive Export to OneDrive (markdown format with attachments)" })] }),
        new Paragraph({ numbering: { reference: "num3", level: 0 }, children: [new TextRun({ text: "Save Attachment to user-specified OneDrive folder with auto-sync" })] }),
        new Paragraph({ numbering: { reference: "num3", level: 0 }, spacing: { after: 200 }, children: [new TextRun({ text: "Context Memory (24-hour retention)" })] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("10.2 V1.1 Features")] }),
        new Paragraph({ numbering: { reference: "num4", level: 0 }, children: [new TextRun({ text: "Hands-Free Driving Mode" })] }),
        new Paragraph({ numbering: { reference: "num4", level: 0 }, children: [new TextRun({ text: "Siri Integration" })] }),
        new Paragraph({ numbering: { reference: "num4", level: 0 }, children: [new TextRun({ text: "Response Screening with tone check" })] }),
        new Paragraph({ numbering: { reference: "num4", level: 0 }, children: [new TextRun({ text: "Quality Scoring for outgoing emails" })] }),
        new Paragraph({ numbering: { reference: "num4", level: 0 }, children: [new TextRun({ text: "Thread Reconstruction and Timeline View" })] }),
        new Paragraph({ numbering: { reference: "num4", level: 0 }, children: [new TextRun({ text: "Attachment Version Timeline and Diff Analysis" })] }),
        new Paragraph({ numbering: { reference: "num4", level: 0 }, spacing: { after: 200 }, children: [new TextRun({ text: "Calendar and Teams integration" })] }),

        // 11. Timeline
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("11. Development Timeline")] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "MVP: 21-29 weeks (~5-7 months)", bold: true })] }),
        
        new Table({
          columnWidths: [3000, 2000, 4360],
          margins: { top: 100, bottom: 100, left: 180, right: 180 },
          rows: [
            new TableRow({ tableHeader: true, children: [
              new TableCell({ borders: cellBorders, shading: { fill: colors.tableBg, type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Phase", bold: true, font: "Times New Roman", size: 22 })] })] }),
              new TableCell({ borders: cellBorders, shading: { fill: colors.tableBg, type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Duration", bold: true, font: "Times New Roman", size: 22 })] })] }),
              new TableCell({ borders: cellBorders, shading: { fill: colors.tableBg, type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Key Deliverables", bold: true, font: "Times New Roman", size: 22 })] })] })
            ]}),
            new TableRow({ children: [
              new TableCell({ borders: cellBorders, children: [new Paragraph({ children: [new TextRun({ text: "Research & Planning", font: "Times New Roman", size: 22 })] })] }),
              new TableCell({ borders: cellBorders, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "3-4 weeks", font: "Times New Roman", size: 22 })] })] }),
              new TableCell({ borders: cellBorders, children: [new Paragraph({ children: [new TextRun({ text: "Graph API validation, agent POC, user interviews", font: "Times New Roman", size: 22 })] })] })
            ]}),
            new TableRow({ children: [
              new TableCell({ borders: cellBorders, children: [new Paragraph({ children: [new TextRun({ text: "Backend Core", font: "Times New Roman", size: 22 })] })] }),
              new TableCell({ borders: cellBorders, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "4-5 weeks", font: "Times New Roman", size: 22 })] })] }),
              new TableCell({ borders: cellBorders, children: [new Paragraph({ children: [new TextRun({ text: "Microsoft auth, Graph API sync, agent service", font: "Times New Roman", size: 22 })] })] })
            ]}),
            new TableRow({ children: [
              new TableCell({ borders: cellBorders, children: [new Paragraph({ children: [new TextRun({ text: "iOS App Core", font: "Times New Roman", size: 22 })] })] }),
              new TableCell({ borders: cellBorders, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "5-6 weeks", font: "Times New Roman", size: 22 })] })] }),
              new TableCell({ borders: cellBorders, children: [new Paragraph({ children: [new TextRun({ text: "OAuth, push/pull UI, priority, compose, search", font: "Times New Roman", size: 22 })] })] })
            ]}),
            new TableRow({ children: [
              new TableCell({ borders: cellBorders, children: [new Paragraph({ children: [new TextRun({ text: "Agent Tools", font: "Times New Roman", size: 22 })] })] }),
              new TableCell({ borders: cellBorders, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "3-4 weeks", font: "Times New Roman", size: 22 })] })] }),
              new TableCell({ borders: cellBorders, children: [new Paragraph({ children: [new TextRun({ text: "Tool implementation, query processing", font: "Times New Roman", size: 22 })] })] })
            ]}),
            new TableRow({ children: [
              new TableCell({ borders: cellBorders, children: [new Paragraph({ children: [new TextRun({ text: "Testing & Polish", font: "Times New Roman", size: 22 })] })] }),
              new TableCell({ borders: cellBorders, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "3-4 weeks", font: "Times New Roman", size: 22 })] })] }),
              new TableCell({ borders: cellBorders, children: [new Paragraph({ children: [new TextRun({ text: "QA, fixes, security audit", font: "Times New Roman", size: 22 })] })] })
            ]}),
            new TableRow({ children: [
              new TableCell({ borders: cellBorders, children: [new Paragraph({ children: [new TextRun({ text: "App Store", font: "Times New Roman", size: 22 })] })] }),
              new TableCell({ borders: cellBorders, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "1-3 weeks", font: "Times New Roman", size: 22 })] })] }),
              new TableCell({ borders: cellBorders, children: [new Paragraph({ children: [new TextRun({ text: "Submission, review, launch", font: "Times New Roman", size: 22 })] })] })
            ]})
          ]
        }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100, after: 300 }, children: [new TextRun({ text: "Table 1: MVP Development Timeline", font: "Times New Roman", size: 18, italics: true, color: colors.secondary })] }),

        // 12. Next Steps
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("12. Next Steps")] }),
        new Paragraph({ numbering: { reference: "bullet", level: 0 }, children: [new TextRun({ text: "Set up Microsoft Azure app registration for Graph API access" })] }),
        new Paragraph({ numbering: { reference: "bullet", level: 0 }, children: [new TextRun({ text: "Create Supabase project for backend infrastructure" })] }),
        new Paragraph({ numbering: { reference: "bullet", level: 0 }, children: [new TextRun({ text: "Build agent search proof-of-concept using Claude Code + GLM" })] }),
        new Paragraph({ numbering: { reference: "bullet", level: 0 }, children: [new TextRun({ text: "Research tone analysis projects on GitHub for foundation" })] }),
        new Paragraph({ numbering: { reference: "bullet", level: 0 }, children: [new TextRun({ text: "Test OneDrive API for attachment save and sync features" })] }),
        new Paragraph({ numbering: { reference: "bullet", level: 0 }, spacing: { after: 200 }, children: [new TextRun({ text: "Research trademark availability for \"Lines\"" })] })
      ]
    }
  ]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("/home/z/my-project/download/lines-project/docs/Lines_Product_Specification_v4.docx", buffer);
  console.log("Document created: Lines_Product_Specification_v4.docx");
});
