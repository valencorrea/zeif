# Robbery Detection Pipeline — Design Spec

**Created**: 2026-03-28
**Status**: Draft

## Overview

A two-stage hybrid detection system that classifies camera frames in real-time and assembles suspicious segments into 5-second video clips for confirmation via an external vision API. The primary use case is detecting **shoplifters and pickpockets in markets and retail stores**. Designed for small commerce (kioscos, farmacias, supermercados) with a single fixed camera, expandable to multi-camera later.

## Target User

Market or retail store owner who installs a camera and wants automatic detection of shoplifters and pickpockets without monitoring the feed manually.

## Architecture — Two-Stage Hybrid Pipeline

### Stage 1: Fast Classification (Local Model)

Each frame from the camera is classified individually by a local model running on the commerce's device.

**What it looks for (per frame):**
- Concealing merchandise (hiding items in clothing, bags, strollers)
- Suspicious hand movements near products (grabbing, palming, pocketing)
- Unusual body positioning (blocking camera view, shielding actions)
- Nervous/evasive behavior (looking around frequently, avoiding staff)
- Tampering with tags or packaging

**Behavior:**
- Must complete classification in ≤ 200ms per frame
- No database writes in this path
- Produces a suspicion score from 0 to 1 per frame
- Each frame's score is stored alongside it in the circular buffer
- Every time the buffer is full (150 frames = 5 seconds), the system computes the **average score** across all 150 frames
- Average < 0.6 → no action, buffer continues overwriting
- Average ≥ 0.6 → the 5-second window is suspicious → capture clip and pass to Stage 2

This approach avoids false positives from a single ambiguous frame. A sustained pattern of suspicious behavior across 5 seconds is required to trigger confirmation.

### Stage 2: Video Confirmation (External Vision API)

When Stage 1's rolling average crosses the 0.6 threshold, the system captures the current 5-second clip from the buffer and sends it to an external vision API (e.g., GPT-4V, Claude Vision) for confirmation.

## Frame Buffer — Circular Buffer

The system maintains a circular buffer that always holds the last 5 seconds of frames.

- Camera produces 30 FPS → buffer holds 150 frames
- The buffer runs continuously, regardless of whether anything is suspicious
- When a new frame arrives and the buffer is full, the oldest frame is overwritten
- Each frame includes: raw image data, timestamp, source camera ID, metadata

**Queue overflow (Principle V):** If the classification queue exceeds 10 frames, skip older frames with logging. Never stall silently.

## Clip Capture — Rolling Average Trigger

When the rolling average of the 150 frames in the buffer crosses 0.6:

1. Copy all 150 frames from the buffer (these ARE the 5-second clip — no pre/post split needed)
2. The buffer resets its scores and keeps running — the camera never stops
3. A cooldown period prevents re-triggering immediately (configurable, default: 30 seconds)

**Why the full buffer IS the clip:** Unlike the previous design where we split 3s pre + 2s post around a single suspicious frame, the rolling average approach means ALL 150 frames contributed to the suspicion. The entire 5-second window is relevant context — the API needs to see the whole sequence that triggered the alert.

## Video Encoding

The 150 captured frames are encoded into a single MP4 file in a background worker thread to avoid blocking the main pipeline.

- **Codec:** H.264
- **Resolution:** 640×480 (downscaled from camera native resolution)
- **Frame rate:** 30 FPS
- **Output size:** ~200-500KB
- **Tool:** FFmpeg or WebCodecs API

The same MP4 serves dual purpose: input for the vision API AND stored evidence.

## External Vision API — Confirmation

The clip is sent to an external vision API with a structured prompt:

**Prompt includes:**
- The 5-second video clip
- Request for structured JSON response: confirmed (boolean), confidence (0-1), description, theft type (shoplifting/pickpocket/none), items targeted, people count
- Zone-specific context from the segment database (e.g., "In this zone, 70% of thefts are shoplifting, 20% are pickpocketing")

**Cost constraint:** Must stay under a few cents per confirmation request. At 640×480 and ~300KB per clip, this is achievable with current API pricing.

**Response handling:**
- `confirmed: true` → proceed to actions
- `confirmed: false` → discard clip, log as false positive from Stage 1

## Actions on Confirmed Theft

**Automatic (always):**
- Save clip to Supabase Storage (evidence)
- Create incident record in database (timestamp, detection type, confidence, clip reference, zone data)
- Log complete event for audit trail

**Owner trigger (in UI):**
- 911 button — shown prominently when an incident is confirmed. Owner decides whether to call.

## Failure Handling

**Vision API failure/timeout:**
1. Retry once
2. If fails again → save clip as "unconfirmed incident" + alert owner
3. Never silently discard a suspicious clip (Principle XI: fail-safe)

**Classification service down:**
- Alert owner that detection is offline
- Silence ≠ all clear

**Encoding failure:**
- Save raw frames as fallback
- Log encoding error
- Still attempt API confirmation with individual frames if possible

## Key Entities

- **ZeifFrame**: Raw image data + timestamp + source camera ID + metadata + suspicion score
- **FrameBuffer**: Circular buffer of 150 ZeifFrames with rolling average calculation
- **Clip**: Encoded MP4 + metadata (average score, trigger timestamp, source buffer)
- **Incident**: Confirmed or unconfirmed event record (timestamp, type, confidence, clip reference, zone context, actions taken)
- **ZoneSegment**: Theft type distribution for the commerce's geographic zone (shoplifting, pickpocketing, etc.)

## Constraints

- Frame classification budget: ≤ 200ms (no DB writes in this path)
- Rolling average threshold: ≥ 0.6 to trigger Stage 2
- Cooldown between triggers: 30 seconds (configurable)
- Clip encoding: runs in background worker thread, never blocks pipeline
- API cost: centavos per detection
- Single fixed camera for MVP, multi-camera designed for later
- Digital-only triggers for now, hardware interface designed for future extensibility
- All Supabase tables require RLS policies

## Scope Boundaries

**In scope:**
- Single camera frame ingestion and buffering
- Two-stage detection (local classification + API confirmation)
- Clip encoding and storage
- Incident recording and audit logging
- 911 button in owner UI

**Out of scope (for now):**
- Multi-camera support
- Hardware triggers (sirens, door locks, lights)
- Push notifications to contact lists
- Automatic escalation to authorities
- Custom model training
- Live stream sharing

## Assumptions

- The commerce has a device capable of running a local classification model (edge device, mini PC, etc.)
- Camera provides a consistent 25-30 FPS feed
- The device has internet connectivity for API calls and Supabase
- FFmpeg or equivalent encoder is available on the device
- Zone segment data is pre-populated or manually configured by the owner
- 640×480 resolution is sufficient for both API analysis and evidence purposes
