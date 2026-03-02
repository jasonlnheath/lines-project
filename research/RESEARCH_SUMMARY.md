# Research Summary

## Overview

This document summarizes research conducted on platform capabilities for the Lines app. Full JSON data is available in the research files.

---

## iOS Capabilities

### Call Filtering (CallKit)

**Status:** ✅ FEASIBLE (with limitations)

**How it works:**
- Call Directory Extension allows blocking and caller ID
- Apps like Truecaller, Hiya use this capability
- Must pre-load blocked numbers database
- Cannot show call history in app
- Cannot intercept calls in real-time

**Key APIs:**
- `CallKit` framework
- `CallDirectoryExtension`
- Settings → Phone → Call Blocking & Identification

**Limitations:**
- Blocking is pre-emptive (pre-loaded list)
- Cannot access call log programmatically
- No real-time call interception
- User must manually enable extension

**Implication for Lines:** Can implement spam blocking and caller ID enhancement, but cannot show "your missed calls" in the app.

### SMS Filtering (IdentityLookup)

**Status:** ⚠️ PARTIALLY FEASIBLE

**How it works:**
- Message Filter Extension for unknown senders
- Can categorize as promotions, transactions, spam
- Works for SMS/MMS only, NOT iMessage
- iOS 16+ supports more categories

**Key APIs:**
- `IdentityLookup` framework
- `MessageFilter` extension
- Settings → Messages → Unknown & Spam

**Limitations:**
- Only unknown senders (not contacts)
- Not for iMessage
- Cannot read full message content without extension activation
- Limited API calls from extension

**Implication for Lines:** SMS filtering possible but limited. Better support on Android for this feature.

### Voicemail Access

**Status:** ❌ NO DIRECT API

**Workaround:** Call forwarding to third-party service

**How it works:**
- Apps like YouMail use call forwarding
- User sets up conditional call forwarding
- Voicemails go to service, then app displays them
- Requires carrier support

**Key Findings:**
- No public API for visual voicemail access
- Third-party services exist (YouMail, Google Voice)
- Requires user setup (dial forwarding codes)

**Implication for Lines:** Voicemail feature would require call forwarding setup, adding friction. Consider for later phase.

---

## Android Capabilities

### SMS & Call Access

**Status:** ✅ MORE CAPABLE THAN iOS

**SMS:**
- `READ_SMS` permission for full access
- `SEND_SMS` for sending
- Can read all messages, including threads
- Background service can listen for new SMS

**Calls:**
- `CallScreeningService` API for call filtering
- Can screen, block, and respond to calls
- `READ_CALL_LOG` for call history access
- More real-time control than iOS

**Key APIs:**
- `android.telecom.CallScreeningService`
- `android.provider.Telephony.SMS`
- `Manifest.permission.READ_SMS`
- `Manifest.permission.READ_CALL_LOG`

**Limitations:**
- Android 13+ has restrictions on background SMS access
- User must grant permissions explicitly
- Some manufacturers restrict further

**Implication for Lines:** Android version would have significantly more capability for SMS/Call integration. Consider Android-first for phone channel features.

---

## Competitive Analysis

### Truecaller (iOS/Android)

**What it does:**
- Caller ID for unknown numbers
- Spam call blocking
- Community-reported spam database
- Shows "Spam Risk" labels

**How it works on iOS:**
- Uses Call Directory Extension
- Pre-loads spam number database
- Identifies calls as they come in
- Can block silently

**Limitations:**
- Cannot show call history in app
- Cannot record calls on iOS
- Database updates require app open

**What Lines can learn:**
- Community-sourced spam data
- Clear labeling system
- Silent blocking option

### Hiya (iOS/Android)

**What it does:**
- Spam and scam call blocking
- Caller ID with name and reason
- Spoofed call detection
- Business caller ID

**Differentiators:**
- "Call reason" feature (why is business calling?)
- Spoofing detection
- Enterprise/business focus

**What Lines can learn:**
- Call reason categorization
- Business caller identification
- Enterprise-friendly features

---

## Platform Policy Summary

| Feature | iOS | Android |
|---------|-----|---------|
| Call Blocking | ✅ Extension | ✅ CallScreeningService |
| Caller ID Enhancement | ✅ Extension | ✅ Full |
| Call Log Access | ❌ No API | ✅ With permission |
| SMS Reading | ❌ No API | ✅ With permission |
| SMS Filtering | ⚠️ Unknown senders only | ✅ Full |
| iMessage Access | ❌ No API | N/A |
| Voicemail Access | ❌ No API | ⚠️ Limited |
| Background Processing | ⚠️ Limited | ✅ More flexible |

---

## Recommendations

### For MVP (iOS + Email)
1. Focus on email features exclusively
2. Use Microsoft Graph API for full email access
3. OneDrive for archive and attachment storage
4. Defer SMS/Call features to Android version

### For V1.1 (SMS/Call)
1. Android-first for phone channel features
2. iOS: Implement Call Directory Extension for basic spam blocking
3. iOS: Implement Message Filter for SMS spam
4. Consider voicemail forwarding service partnership

### For Competitive Positioning
1. Differentiate on email intelligence (tone, priority, agent search)
2. Don't compete directly with Truecaller on call features
3. Position as "email-first unified communication"
4. Phone/SMS features as enhancement, not core

---

## Files Included

| File | Content |
|------|---------|
| research_ios_calls.json | iOS CallKit/Call Directory research |
| research_ios_sms.json | iOS SMS filtering research |
| research_ios_voicemail.json | iOS voicemail access research |
| research_ios_call_limits.json | iOS extension limitations |
| research_android_sms.json | Android SMS/Call API research |
| research_call_apps.json | Truecaller/Hiya competitive analysis |
| research_voicemail_workaround.json | Voicemail forwarding solutions |
