# Lines Project - Clustering Validation Test Plan

## Context

The email clustering function is not working correctly. To validate it, we need a ground-truth dataset: real Microsoft Graph email thread statistics (30 days). Since Microsoft Graph already groups emails by `conversationId` (threads), these threads are the authoritative groupings we can compare clustering output against.

**Goal:** Create an automated backend test endpoint that:
1. Extracts 30-day thread statistics from Microsoft Graph (ground truth)
2. Compares the clustering output against those thread stats
3. Reports matches, mismatches, missing clusters, and name accuracy

---

## What Exists (Key Files)

| File | Relevance |
|------|----------|
| `prototype/app/api/graph/topics/route.ts` | Clustering API — triggers `TopicClusteringService.clusterEmails()` |
| `prototype/services/graph/topicMapping/clusteringService.ts` | Thread-first clustering using `conversationId`; `generateThreadName()` strips RE:/FW: |
| `prototype/services/graph/storage/graphStorageManager.ts` | `getAllEmails()`, `getTopicClusters()`, `getEmailsByConversation()` |
| `prototype/services/agent/tools.ts` | `fetchTool` — knows Graph API patterns for date-filtered email fetching |
| `prototype/app/api/graph/emails/route.ts` | Email retrieval from local storage (by cluster or ID) |
| `prototype/app/api/graph/utils.ts` | `getUserIdFromRequest()` — reuse for auth |

---

## Implementation Plan

### New File: `prototype/app/api/graph/test/route.ts`

A single GET endpoint with three actions via query param `?action=`:

#### Action 1: `thread-stats` — Ground Truth from Microsoft Graph

Fetch all emails in the last 30 days from Graph (paginated), group by `conversationId`:

```
GET /me/messages?
  $filter=receivedDateTime ge {30daysAgo}&
  $select=id,subject,conversationId,receivedDateTime,from&
  $top=999
  (follow @odata.nextLink for pagination)
```

Returns:
```json
{
  "period": "2026-02-04 to 2026-03-06",
  "totalEmails": 247,
  "threadCount": 43,
  "threads": [
    {
      "conversationId": "AAQk...",
      "name": "Budget Review Q1",
      "emailCount": 5,
      "subjectVariations": ["Budget Review Q1", "RE: Budget Review Q1"],
      "firstDate": "2026-02-10",
      "lastDate": "2026-02-15"
    }
  ]
}
```

Thread name = first email's subject with RE:/FW:/Fwd: stripped (mirrors `clusteringService.generateThreadName()` exactly).

#### Action 2: `validate-clustering` — Compare Clusters vs Threads

1. Fetch thread stats from Graph (as above)
2. Load clusters from local `GraphStorageManager`
3. For each thread: find which cluster(s) contain its emails (by email ID overlap)
4. For each cluster: find which thread(s) it corresponds to

Match categories:
- **perfect** — cluster contains ALL emails from exactly ONE thread, name matches
- **partial** — cluster contains most emails from a thread but not all, or spans multiple threads
- **missing** — thread has no corresponding cluster in local storage
- **spurious** — cluster exists but none of its emails match any 30-day thread
- **name_mismatch** — email IDs match but cluster name ≠ thread name

Returns:
```json
{
  "summary": {
    "threadCount": 43,
    "clusterCount": 38,
    "perfectMatches": 35,
    "partialMatches": 3,
    "missingClusters": 5,
    "spuriousClusters": 2,
    "nameMatches": 34
  },
  "threads": [
    {
      "conversationId": "AAQk...",
      "threadName": "Budget Review Q1",
      "threadEmailCount": 5,
      "matchedClusterId": "cluster-thread-AAQk-...",
      "clusterName": "Budget Review Q1",
      "clusterEmailCount": 5,
      "coverage": 1.0,
      "matchType": "perfect",
      "nameMatch": true
    }
  ],
  "unmatchedClusters": [...]
}
```

#### Action 3: `full-report` — Both Combined (default)

Returns thread stats + validation in a single call for convenience.

---

## Key Implementation Details

### Pagination for Graph API
The `fetchTool` pattern shows how Graph API works. For the test endpoint:
```typescript
async function fetchAllEmailsLast30Days(accessToken: string): Promise<GraphMessage[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const filter = `receivedDateTime ge ${thirtyDaysAgo.toISOString()}`;

  let url = `https://graph.microsoft.com/v1.0/me/messages?$filter=${encodeURIComponent(filter)}&$select=id,subject,conversationId,receivedDateTime,from&$top=999`;
  const allMessages: GraphMessage[] = [];

  while (url) {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();
    allMessages.push(...(data.value || []));
    url = data['@odata.nextLink'] || null;
  }
  return allMessages;
}
```

### Thread Name Normalization
Must match exactly what `clusteringService.generateThreadName()` does:
```typescript
function normalizeThreadName(subject: string): string {
  return subject
    .replace(/^(RE|FW|Fwd):\s*/i, '')
    .replace(/\s*\*/g, ' ')
    .trim()
    .substring(0, 50);
}
```

### Auth Pattern
Reuse `getUserIdFromRequest()` from `prototype/app/api/graph/utils.ts`, plus read the `access_token` cookie for Graph API calls (same pattern as `/api/agent/query`).

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `prototype/app/api/graph/test/route.ts` | **CREATE** — test endpoint (GET with ?action=) |

No existing files need modification.

---

## Verification

1. Start dev server: `cd prototype && npm run dev`
2. Login with Microsoft account at `http://localhost:3000`
3. Test thread stats (ground truth):
   ```
   GET http://localhost:3000/api/graph/test?action=thread-stats
   ```
   → Should see threads with email counts matching what you see in Outlook
4. Load emails into graph (existing flow through UI or POST `/api/graph/topics` with `action=cluster`)
5. Run clustering: POST `/api/graph/topics` with `{"action": "cluster"}`
6. Validate clustering:
   ```
   GET http://localhost:3000/api/graph/test?action=validate-clustering
   ```
   → Should show which threads are correctly/incorrectly clustered
7. Full report:
   ```
   GET http://localhost:3000/api/graph/test?action=full-report
   ```

---

## Notes

- The `thread-stats` action works independently of whether emails have been loaded into local storage — it reads directly from Microsoft Graph
- The `validate-clustering` action requires emails to already be loaded into the graph storage AND clustering to have been run
- Thread coverage is expected to be < 100% since only emails in local storage can be in clusters
- The report exposes the exact nature of any clustering bugs (wrong names, split threads, merged threads, etc.)
