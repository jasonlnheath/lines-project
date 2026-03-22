# Test Specification: Contact Relationship Context Provider

## Overview

Tests for the agent-driven contact learning system that provides push/pull decisions based on auto-detected relationships (manager, executives, team) and user preferences.

## Test Cases

### Test 1: Manager Detection
**Input:** Email address matching configured manager email
**Expected Output:**
- `shouldPush: true`
- `priority: 'high'`
- `reason: 'your_manager'`
**Tolerance:** Exact match

### Test 2: Executive Detection by Title
**Input:** Contact with job title containing executive keywords (CEO, VP, Owner, Founder, Director)
**Expected Output:** `isExecutive: true`
**Tolerance:** Exact match for these patterns:
- CEO, CTO, CFO, CIO, COO, CMO
- Vice President, VP
- Owner, Founder, President, Director

### Test 3: User Preference Override
**Input:** Contact with explicit `pushPreference: 'push'`
**Expected Output:**
- `shouldPush: true`
- `reason: 'user_designated_push'`
**Tolerance:** Exact match

### Test 4: Default Pull for Unknown External
**Input:** Unknown sender from different domain
**Expected Output:**
- `shouldPush: false`
- `reason: 'default_pull'`
- `isInternal: false`
**Tolerance:** Exact match

### Test 5: Internal Sender Detection
**Input:** Sender from same domain as user
**Expected Output:** `isInternal: true`
**Tolerance:** Exact match

### Test 6: Progressive Disclosure Prompt
**Input:** Unknown sender email
**Expected Output:** NewSenderPrompt object with:
- `suggestedAction: 'pull'` (external) or `'ask'` (internal)
- `detectedInfo.isInternal` correct
**Tolerance:** Exact match

### Test 7: Frequent Contact Detection
**Input:** Contact with `relevanceScore >= 7`
**Expected Output:**
- `shouldPush: true`
- `reason: 'frequent_contact'`
**Tolerance:** Exact match

### Test 8: Favorite Contact
**Input:** Contact with `isFavorite: true`
**Expected Output:**
- `shouldPush: true`
- `reason: 'favorite_contact'`
**Tolerance:** Exact match

### Test 9: Direct Report with Urgent Keywords
**Input:** Direct report contact + email with urgent keywords
**Expected Output:**
- `shouldPush: true`
- `reason: 'team_member_urgent'`
**Tolerance:** Exact match

### Test 10: Priority Order (CYA Rules)
**Input:** Multiple matching conditions
**Expected Output:** Highest priority rule wins:
1. Manager > Executive > User Preference > Frequent > Favorite > Internal
**Tolerance:** Exact match for priority order

## Edge Cases
- Manager email not configured (should not crash)
- Contact with no email addresses (should handle gracefully)
- Contact with multiple email addresses (should match any)
- Empty/undefined job title (should not be executive)
- Contact with "Vice President" vs "Vice Principal" (only VP/President patterns)

## Pass Criteria
- All 10 test cases pass
- No crashes or unhandled exceptions
- Performance: < 100ms per getPushDecision call
