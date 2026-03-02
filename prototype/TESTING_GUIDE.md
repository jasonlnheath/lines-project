# Lines Prototype - Testing Guide

## Overview

This guide covers end-to-end testing of the Lines prototype with real Microsoft Graph data.

## Prerequisites

1. **Microsoft Azure Account** with access to create app registrations
2. **Microsoft 365 Email Account** with emails to test with
3. **Anthropic API Key** for Claude/LLM features
4. **Node.js 18+** installed locally

## Setup Steps

### 1. Azure App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Enter name: "Lines Prototype"
5. Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
6. Redirect URI: `http://localhost:3000/api/auth/callback`
7. Click **Register**

### 2. Configure API Permissions

1. In your app registration, go to **API permissions**
2. Click **Add a permission** → **Microsoft Graph** → **Delegated permissions**
3. Add these permissions:
   - `User.Read` - Read user profile
   - `Mail.Read` - Read emails
   - `Mail.ReadWrite` - Read and write emails
   - `Mail.Send` - Send emails
   - `Files.ReadWrite` - Read and write OneDrive files
   - `Files.ReadWrite.All` - Read and write all OneDrive files
4. Click **Add permissions**
5. Click **Grant admin consent** for your organization

### 3. Create Client Secret

1. Go to **Certificates & secrets**
2. Click **New client secret**
3. Description: "Lines Prototype Secret"
4. Expires: 180 days
5. Click **Add**
6. **Copy the secret value** immediately (you won't see it again)

### 4. Configure Environment Variables

Create `prototype/.env.local`:

```bash
AZURE_CLIENT_ID=your_client_id_here
AZURE_TENANT_ID=your_tenant_id_or_common
AZURE_CLIENT_SECRET=your_client_secret_here
AZURE_REDIRECT_URI=http://localhost:3000/api/auth/callback

ANTHROPIC_API_KEY=your_anthropic_api_key_here

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Get Anthropic API Key

1. Go to [Anthropic Console](https://console.anthropic.com)
2. Create an API key
3. Add to `.env.local`

## Running the Prototype

```bash
cd prototype
npm run dev
```

Visit http://localhost:3000

## Test Scenarios

### Test 1: Authentication Flow

1. Click "Login with Microsoft"
2. Sign in with your Microsoft account
3. Grant permissions if prompted
4. Verify user name and email appear in header
5. Refresh page - verify authentication persists

**Expected Results:**
- User is redirected to Microsoft login page
- After login, user is redirected back to the app
- User's name and email are displayed
- Tokens are stored in secure cookies

### Test 2: Agent Search - Basic Queries

1. Ensure you're logged in
2. Try these queries one at a time:

```
"Show me my most recent emails"
"Find emails from [someone you know]"
"What emails have attachments?"
```

**Expected Results:**
- Query is processed
- Tool trace shows which tools were executed
- Answer is displayed with relevant email information
- Each tool shows success/failure status

### Test 3: Agent Search - Specific Tools

Test individual tool usage:

```
"Read the most recent email"
"Search for emails containing 'budget'"
"Find emails with 'invoice' in the subject"
"Show me emails I received this week"
```

**Expected Results:**
- Correct tool is selected for each query type
- Results include relevant email data
- Duration is shown for each tool execution

### Test 4: OneDrive Integration

1. Click "List Folders"
2. Verify folders from your OneDrive are shown
3. Select a folder (or leave empty for root)
4. Choose a small test file to upload
5. Optionally check "Use Lines Archive folder structure"
6. Click "Upload File"
7. Click "View in OneDrive" link

**Expected Results:**
- Folders are listed correctly
- File uploads successfully
- Success message appears with file name
- OneDrive link opens the uploaded file
- If archive option selected, file is in Year/Q/Month structure

### Test 5: Token Refresh

1. Log in and wait for token to expire (or manually delete cookies)
2. Try a search query
3. Verify "refresh required" message appears

**Expected Results:**
- Token expiration is detected
- App prompts for re-authentication

### Test 6: Error Handling

Test error scenarios:

1. **Not authenticated:**
   - Open in incognito window
   - Try to search
   - Expected: "Not authenticated" error

2. **Invalid query:**
   - Submit empty query
   - Expected: Validation error

3. **Network error:**
   - Disconnect internet
   - Try to search
   - Expected: "Failed to connect" error

## Performance Benchmarks

Measure these metrics:

| Metric | Target | Actual |
|--------|--------|--------|
| Page load (authenticated) | < 2s | ___ |
| Search query response | < 3s | ___ |
| Tool execution (read) | < 500ms | ___ |
| Tool execution (grep) | < 1s | ___ |
| File upload (1MB) | < 5s | ___ |

## Known Limitations

1. **Summarize tool:** Uses extractive summary (production should use LLM)
2. **Grep tool:** Basic implementation without advanced regex
3. **Glob tool:** Attachment filtering not fully implemented
4. **Tool planning:** Basic LLM-based, could be more sophisticated

## Troubleshooting

### "Token expired" error

- Click "Logout" then login again
- Or refresh the page (auto-refresh may be implemented)

### OneDrive upload fails

- Check file size (large files may timeout)
- Verify OneDrive has storage space
- Check API permissions include Files.ReadWrite

### Search returns no results

- Verify Mail.Read permission is granted
- Check that the account has emails
- Try different search terms

### Build errors

```bash
cd prototype
rm -rf .next node_modules
npm install
npm run build
```

## Next Steps

After testing:

1. Document actual vs expected behavior
2. Record performance metrics
3. Note any bugs or issues
4. Provide feedback for mobile implementation

## Mobile Transition Considerations

Based on testing, consider these for mobile:

1. **Offline caching:** Prototype has none - mobile will need SQLite
2. **Push notifications:** Not implemented - mobile will need APNs/FCM
3. **Biometric auth:** Consider Face ID/Touch ID for mobile
4. **Background sync:** Prototype requires foreground - mobile needs background tasks
5. **Voice interface:** Consider voice input for hands-free use
