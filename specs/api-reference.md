# API Reference Template

## Overview

This document will contain API documentation as development progresses. Use this template structure for consistency.

---

## Authentication APIs

### Microsoft Graph OAuth

```
POST /api/auth/microsoft/token
```

**Request:**
```json
{
  "code": "authorization_code_from_microsoft",
  "redirect_uri": "lines://auth/callback"
}
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "expires_in": 3600,
  "user": {
    "id": "user-uuid",
    "email": "user@company.com",
    "name": "User Name"
  }
}
```

---

## Email APIs

### Pull Inbox

```
GET /api/emails/pull
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| priority | string | 'high', 'medium', 'low', or 'all' |
| since | timestamp | Pull messages after this time |
| limit | number | Max messages to return |

**Response:**
```json
{
  "messages": [
    {
      "id": "email-uuid",
      "subject": "Re: Budget Review",
      "from": {
        "email": "john@company.com",
        "name": "John Smith"
      },
      "preview": "First 100 characters...",
      "priority": "high",
      "tone": "green",
      "received_at": "2025-01-15T14:32:00Z",
      "has_attachments": true,
      "thread_count": 5
    }
  ],
  "total": 12,
  "has_more": true
}
```

### Get Email

```
GET /api/emails/{id}
```

**Response:**
```json
{
  "id": "email-uuid",
  "microsoft_id": "AAMkAG...",
  "thread_id": "AQAAAA...",
  "subject": "Re: Budget Review",
  "from": {
    "email": "john@company.com",
    "name": "John Smith"
  },
  "to": [
    { "email": "me@company.com", "name": "Me" }
  ],
  "cc": [
    { "email": "sarah@company.com", "name": "Sarah Jones" }
  ],
  "body_html": "<html>...</html>",
  "body_text": "Plain text version...",
  "priority": "high",
  "tone": "green",
  "tone_confidence": 0.85,
  "received_at": "2025-01-15T14:32:00Z",
  "attachments": [
    {
      "id": "attach-uuid",
      "name": "Budget_v3.xlsx",
      "size": 245760,
      "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }
  ]
}
```

### Send Email

```
POST /api/emails/send
```

**Request:**
```json
{
  "to": ["recipient@company.com"],
  "cc": ["cc@company.com"],
  "subject": "Re: Budget Review",
  "body": "Email content...",
  "in_reply_to": "original-email-id",
  "attachments": ["attach-uuid-1", "attach-uuid-2"]
}
```

**Response:**
```json
{
  "id": "new-email-uuid",
  "sent_at": "2025-01-15T15:00:00Z",
  "status": "sent"
}
```

---

## Agent Search APIs

### Natural Language Search

```
POST /api/agent/search
```

**Request:**
```json
{
  "query": "Find the budget PDF John sent last month",
  "context": {
    "timeframe": "last_30_days",
    "preferred_senders": ["john@company.com"]
  }
}
```

**Response:**
```json
{
  "results": [
    {
      "email_id": "email-uuid",
      "subject": "Budget Review",
      "from": "john@company.com",
      "date": "2024-12-20",
      "relevance_score": 0.95,
      "match_reason": "Subject contains 'budget', attachment is PDF, from John Smith"
    }
  ],
  "explanation": "Found 1 email from John Smith with 'budget' in the subject containing a PDF attachment from December 2024.",
  "tools_used": ["grep", "glob", "read"]
}
```

---

## Priority APIs

### Get Priority Rules

```
GET /api/priority/rules
```

**Response:**
```json
{
  "rules": [
    {
      "id": "rule-uuid",
      "type": "sender",
      "value": "boss@company.com",
      "priority": "high",
      "push_notify": true,
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### Create Priority Rule

```
POST /api/priority/rules
```

**Request:**
```json
{
  "type": "sender",
  "value": "boss@company.com",
  "priority": "high",
  "push_notify": true
}
```

---

## Archive APIs

### Export Email to Archive

```
POST /api/archive/export
```

**Request:**
```json
{
  "email_ids": ["email-uuid-1", "email-uuid-2"],
  "include_attachments": true,
  "folder": "/Lines Archive/2025/Q1"
}
```

**Response:**
```json
{
  "exported": 2,
  "files": [
    {
      "email_id": "email-uuid-1",
      "archive_path": "/Lines Archive/2025/Q1/January/2025-01-15_john-smith_budget.md"
    }
  ]
}
```

### Save Attachment to OneDrive

```
POST /api/attachments/save
```

**Request:**
```json
{
  "attachment_id": "attach-uuid",
  "email_id": "email-uuid",
  "folder": "/Lines Attachments/2025",
  "filename": "Budget_v3_final.xlsx"
}
```

**Response:**
```json
{
  "success": true,
  "onedrive_path": "/Lines Attachments/2025/Budget_v3_final.xlsx",
  "download_url": "https://...",
  "sync_status": "syncing"
}
```

---

## Tone Analysis APIs

### Analyze Email Tone

```
POST /api/tone/analyze
```

**Request:**
```json
{
  "content": "Email body text to analyze...",
  "sender": "john@company.com",
  "context": {
    "relationship": "manager",
    "previous_tone": "green"
  }
}
```

**Response:**
```json
{
  "tone": "yellow",
  "confidence": 0.78,
  "signals": {
    "frustration_indicators": ["disappointed", "expected better"],
    "urgency_indicators": [],
    "positive_indicators": ["thanks", "appreciate"]
  },
  "recommendation": "This message shows mild frustration. Consider a thoughtful response acknowledging concerns."
}
```

### Analyze Outgoing Tone

```
POST /api/tone/outgoing
```

**Request:**
```json
{
  "content": "Draft email response...",
  "original_email_id": "email-uuid",
  "recipient": "john@company.com"
}
```

**Response:**
```json
{
  "tone": "red",
  "confidence": 0.85,
  "warnings": [
    {
      "type": "frustration",
      "message": "I'm detecting frustration in your tone. Is this intentional?",
      "suggestions": ["Take a break before sending", "Consider softening language"]
    }
  ],
  "quality_score": "C+",
  "improvement_suggestions": [
    "Address the budget concern explicitly",
    "Add specific timeline"
  ]
}
```

---

## Context Memory APIs

### Store Context

```
POST /api/context/store
```

**Request:**
```json
{
  "thread_id": "thread-uuid",
  "type": "entities",
  "content": {
    "key_people": ["John Smith", "Sarah Jones"],
    "decisions": ["Budget approved for Q2"],
    "action_items": ["Review by Friday"]
  }
}
```

### Retrieve Context

```
GET /api/context/{thread_id}
```

**Response:**
```json
{
  "thread_id": "thread-uuid",
  "contexts": [
    {
      "type": "entities",
      "content": { ... },
      "created_at": "2025-01-15T10:00:00Z"
    }
  ],
  "summary": "Thread about Q2 budget review. Key decision: approved. Action: review by Friday."
}
```

---

## Webhook Endpoints

### Microsoft Graph Notifications

```
POST /api/webhooks/microsoft
```

**Purpose:** Receive notifications for new emails

**Request:** From Microsoft Graph API
```json
{
  "value": [
    {
      "subscriptionId": "...",
      "changeType": "created",
      "resource": "Users/user-id/Messages/message-id",
      "tenantId": "...",
      "clientState": "secret"
    }
  ]
}
```

---

## Error Responses

All endpoints return consistent error format:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Human readable error message",
    "details": {}
  }
}
```

**Common Error Codes:**
| Code | HTTP Status | Description |
|------|-------------|-------------|
| UNAUTHORIZED | 401 | Invalid or expired token |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |
