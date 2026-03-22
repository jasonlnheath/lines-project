# Test Specification: Role-Based Onboarding Agent

## Overview

Tests for the agent-driven onboarding system that learns user preferences through conversation based on their detected role.

## Test Cases

### Test 1: Role Detection from Graph API Profile
**Input:** User profile with `jobTitle: "Sales Manager"`, `department: "Sales"`
**Expected Output:** `inferredRole: "sales"`, `confidence: "high"`
**Tolerance:** Exact match

### Test 2: Role Detection from Job Title Patterns
**Input:** Various job titles
**Expected Output:**
- "Vice President of Engineering" → "executive"
- "Software Developer" → "engineering"
- "Account Manager" → "sales"
- "HR Business Partner" → "hr"
- "Financial Analyst" → "finance"
**Tolerance:** Exact match

### Test 3: Onboarding Question Generation
**Input:** User role `sales`
**Expected Output:** Questions about:
- Customers (suggest: push)
- Prospects (suggest: push)
- Vendors (suggest: pull)
- Partners (suggest: push)
**Tolerance:** Exact match for question categories

### Test 4: Onboarding Question Generation - Executive Role
**Input:** User role `executive`
**Expected Output:** Questions about:
- Direct reports (suggest: push)
- Board members (suggest: push)
- Media contacts (suggest: ask)
**Tolerance:** Exact match

### Test 5: CYA Contact Pre-fill
**Input:** Manager email from Graph API, detected executives
**Expected Output:** Pre-filled list of always-push contacts
**Tolerance:** Contains expected contacts

### Test 6: Company Category Extraction
**Input:** User's Outlook contacts with company names
**Expected Output:** Grouped by company domain
**Tolerance:** Reasonable grouping

### Test 7: Onboarding Summary Generation
**Input:** User's answers to onboarding questions
**Expected Output:** Final summary with:
- Always-push contacts (manager, executives, user selections)
- Company-level rules (customers push, vendors pull, etc.)
**Tolerance:** Correct aggregation

### Test 8: Progressive Learning - New Contact
**Input:** Email from new sender after onboarding complete
**Expected Output:** Prompt asking push/pull preference
**Tolerance:** Exact structure

## Edge Cases
- User has no manager (null response from /me/manager)
- User has no direct reports
- User's department is undefined
- Job title doesn't match any pattern
- No contacts in Outlook

## Pass Criteria
- All 8 test cases pass
- No crashes on edge cases
- Onboarding completes in < 30 seconds
