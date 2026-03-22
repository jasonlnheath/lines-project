# Test Specification: Learning Loop Components

## Overview
Tests for the cluster-aware search with learning loop system, including SemanticProfileManager and SuggestionQueueService.

## Test Cases

### SemanticProfileManager Tests

#### Test 1: Centroid Calculation
**Input:** Two emails with embeddings [1, 2, 3] and [3, 4, 5]
**Expected Output:** Centroid [2, 3, 4]
**Tolerance:** 0.001 for floating point

#### Test 2: Incremental Centroid Update
**Input:** Current centroid [2, 3, 4], new email [5, 6, 7], α=0.1
**Expected Output:** New centroid [2.3, 3.3, 4.3] (EMA: 0.9*old + 0.1*new)
**Tolerance:** 0.001

#### Test 3: Key Term Extraction
**Input:** Emails with subjects "Project Update" and "Meeting about Project"
**Expected Output:** Key terms include "project" with high weight
**Tolerance:** N/A (string matching)

#### Test 4: Profile Cache TTL
**Input:** Get profile, wait 6 minutes, get again
**Expected Output:** Second call rebuilds profile (TTL=5min)

### SuggestionQueueService Tests

#### Test 5: Orphan Similarity Calculation
**Input:** Orphan email with terms "project", "update", cluster profile with "project" weight 0.9
**Expected Output:** Similarity > 0.5
**Tolerance:** 0.01

#### Test 6: Thread Merge Similarity
**Input:** Two cluster profiles with centroids [1,2,3] and [1.1,2.1,3.1]
**Expected Output:** Cosine similarity > 0.95
**Tolerance:** 0.01

#### Test 7: Queue Mode Processing
**Input:** 3 suggestions with scores 0.8, 0.5, 0.2, autoBranchEnabled=false
**Expected Output:** All 3 queued, 0 auto-executed

#### Test 8: Auto Mode Processing
**Input:** 3 suggestions with scores 0.8, 0.5, 0.2, autoBranchEnabled=true, threshold=0.7
**Expected Output:** 1 auto-executed (0.8), 2 queued

#### Test 9: Branch Orphan
**Input:** Cluster with 2 emails, orphan email with similarity 0.8
**Expected Output:** Orphan added to cluster emailIds, centroid updated

#### Test 10: Merge Clusters
**Input:** Target cluster (3 emails), source cluster (2 emails)
**Expected Output:** Target has 5 emails, source deleted

### API Integration Tests

#### Test 11: Cluster Search Endpoint
**Input:** GET /api/graph/clusters/search?query=project
**Expected Output:** Returns clusters with "project" in key terms
**Tolerance:** N/A

#### Test 12: Suggestions GET Endpoint
**Input:** GET /api/graph/clusters/{id}/suggestions
**Expected Output:** Returns pending suggestions with enriched details
**Tolerance:** N/A

#### Test 13: Suggestions POST Accept
**Input:** POST /api/graph/clusters/{id}/suggestions {action: "accept", suggestionId}
**Expected Output:** Suggestion executed, cluster updated
**Tolerance:** N/A

## Edge Cases
- Empty cluster (no emails)
- Orphan with no embedding
- Duplicate suggestions
- Cluster with no profile
- Invalid suggestion ID

## Pass Criteria
- All test cases pass
- No crashes on edge cases
- Centroid updates within tolerance
- Similarity scores 0-1 range
