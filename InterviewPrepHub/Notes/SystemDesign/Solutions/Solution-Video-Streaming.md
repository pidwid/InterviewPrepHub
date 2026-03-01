# Design YouTube / Netflix Video Streaming

Video streaming platforms serve billions of hours of video daily. YouTube handles 500+ hours of video uploaded per minute and serves 1 billion hours of watch time per day. Netflix delivers 100M+ hours daily. The key challenges are video ingestion, transcoding, storage, and adaptive streaming at massive scale.

---

## Step 1 — Understand the Problem & Establish Design Scope

### Clarifying Questions

**Candidate:** Are we designing a YouTube-like platform (user uploads) or Netflix-like (curated content)?  
**Interviewer:** YouTube-like — anyone can upload, anyone can watch. But cover streaming optimizations Netflix pioneered.

**Candidate:** What features should we focus on?  
**Interviewer:** Video upload, video processing (transcoding), video streaming/playback, and basic feed. Skip comments, likes, and subscriptions.

**Candidate:** What video quality levels do we need?  
**Interviewer:** Multiple resolutions: 240p, 360p, 480p, 720p, 1080p, 4K. Adaptive bitrate streaming.

**Candidate:** What's the expected scale?  
**Interviewer:** 5 million DAU, 10% upload videos (500K uploads/day), average video: 5 minutes.

**Candidate:** What are the supported clients?  
**Interviewer:** Mobile (iOS, Android), web, and smart TVs.

### Functional Requirements

- Users upload videos (up to 1 GB, 1 hour max)
- System transcodes videos into multiple resolutions and formats
- Users stream/watch videos with adaptive quality based on bandwidth
- Basic video feed and search

### Non-Functional Requirements

- **Availability:** 99.99% — streaming must not go down
- **Low latency:** Video starts playing within 2 seconds
- **Scalability:** 5M DAU, 500K uploads/day, millions gof concurrent streams
- **Global reach:** Low-latency streaming worldwide via CDN
- **Cost efficiency:** Storage and bandwidth are the biggest costs

### Back-of-the-Envelope Estimation

- **Uploads:** 500K videos/day, avg 300 MB each = 150 TB/day raw uploads
- **Transcoded output:** Each video → 5 resolutions × 2 formats = 10 versions → ~1 PB/day
- **Storage growth:** 1 PB/day × 365 = 365 PB/year
- **Streaming bandwidth:** 5M DAU × 30 min/day × 5 Mbps avg = 12.5 Tbps peak
- **Upload bandwidth:** 500K × 300 MB / 86400 sec = 1.7 TB/s = 13.9 Tbps

---

## Step 2 — High-Level Design

### Two Core Flows

```
Flow 1: Video Upload & Processing Pipeline
─────────────────────────────────────────
User uploads video → Store raw → Transcode → Store processed → CDN

Flow 2: Video Streaming
───────────────────────
User requests video → CDN serves closest copy → Adaptive streaming
```

### API Design

```
-- Upload video --
POST /api/v1/videos/upload-url
  Response: {
    "uploadUrl": "https://s3.amazonaws.com/raw-videos/...",  // Pre-signed URL
    "videoId": "vid_123"
  }

// Client uploads directly to S3 using pre-signed URL (no proxy through app servers)

-- Complete upload --
POST /api/v1/videos/{videoId}/complete
  Body: { "title": "My Video", "description": "...", "tags": ["tech"] }
  Response: { "status": "processing" }

-- Get video (streaming manifest) --
GET /api/v1/videos/{videoId}
  Response: {
    "videoId": "vid_123",
    "title": "My Video",
    "manifestUrl": "https://cdn.example.com/vid_123/master.m3u8",
    "thumbnailUrl": "https://cdn.example.com/vid_123/thumb.jpg",
    "duration": 305,
    "status": "ready"
  }

-- Video feed --
GET /api/v1/feed?cursor={cursor}&limit=20
  Response: { "videos": [...], "nextCursor": "..." }
```

### High-Level Architecture

```
┌──────────┐                              ┌──────────────┐
│  Client  │──── upload (pre-signed) ────▶│  S3 (Raw)    │
│          │                              └──────┬───────┘
│          │                                     │ S3 Event
│          │     ┌──────────────┐          ┌─────▼───────┐
│          │────▶│  API Server  │          │  Transcoder │
│          │     │  (Metadata)  │          │  Pipeline   │
│          │     └──────┬───────┘          └─────┬───────┘
│          │            │                        │
│          │     ┌──────▼───────┐         ┌──────▼───────┐
│          │     │  Video DB    │         │  S3 (Processed)│
│          │     │  (Metadata)  │         └──────┬───────┘
│          │     └──────────────┘                │
│          │                              ┌──────▼───────┐
│          │◀──── stream (HLS/DASH) ──────│     CDN      │
│          │                              │ (CloudFront) │
└──────────┘                              └──────────────┘
```

---

## Step 3 — Design Deep Dive

### Video Upload: Pre-Signed URL Pattern

```
Why not upload through API servers?
  - Video files are 100 MB - 1 GB
  - Proxying through app servers wastes bandwidth and compute
  - Ties up connections for minutes

Solution: Client uploads directly to S3

1. Client requests upload URL from API server
2. API server generates pre-signed S3 URL (expires in 15 min)
3. Client uploads directly to S3 using PUT against pre-signed URL
4. S3 triggers event (Lambda / SQS) when upload completes
5. Pipeline begins processing

┌────────┐    ┌──────────┐    ┌────────┐
│ Client │───▶│ API Svr  │    │   S3   │
│        │    │          │    │  (Raw) │
└───┬────┘    └────┬─────┘    └───┬────┘
    │              │              │
    │─ GET upload URL ──▶         │
    │◀─ pre-signed URL ──         │
    │                             │
    │──── PUT video file ────────▶│
    │                             │──▶ S3 Event → Transcoder
    │◀──── 200 OK ───────────────│
```

### Video Transcoding Pipeline

This is the most complex and compute-intensive component:

```
Raw Video → Transcoding Pipeline → Multiple Output Formats

Pipeline Stages:
┌─────────────┐    ┌──────────────┐    ┌──────────────┐
│ 1. Validate │───▶│ 2. Transcode │───▶│ 3. Package   │
│   & Inspect │    │   (FFmpeg)   │    │   (HLS/DASH) │
└─────────────┘    └──────────────┘    └──────┬───────┘
                                              │
                                       ┌──────▼───────┐
                                       │ 4. Thumbnail │
                                       │   Generation │
                                       └──────┬───────┘
                                              │
                                       ┌──────▼───────┐
                                       │ 5. Upload to │
                                       │   S3 + CDN   │
                                       └──────────────┘
```

**Stage 1: Validate & Inspect**
```
- Verify file format (MP4, MOV, AVI, MKV, WebM)
- Check codec (H.264, H.265, VP9, AV1)
- Extract metadata: resolution, duration, frame rate, audio tracks
- Reject: corrupted files, files > 1 GB, duration > 1 hour
- Content moderation: scan for copyrighted content, NSFW
```

**Stage 2: Transcode**
```
Input: 1080p raw video at 8 Mbps

Output (multiple resolutions):
┌────────────┬─────────┬──────────┬───────────┐
│ Resolution │ Bitrate │ Size/min │ Codec     │
├────────────┼─────────┼──────────┼───────────┤
│ 4K (2160p) │ 20 Mbps │ 150 MB   │ H.265     │
│ 1080p      │ 5 Mbps  │ 37.5 MB  │ H.264     │
│ 720p       │ 2.5 Mbps│ 18.75 MB │ H.264     │
│ 480p       │ 1 Mbps  │ 7.5 MB   │ H.264     │
│ 360p       │ 0.5 Mbps│ 3.75 MB  │ H.264     │
│ 240p       │ 0.3 Mbps│ 2.25 MB  │ H.264     │
└────────────┴─────────┴──────────┴───────────┘

Each resolution encoded in parallel on different machines.
Total output: ~6× input size (all resolutions combined)
```

**Stage 3: Package into Streaming Format**
```
HLS (HTTP Live Streaming) — Apple, most widely supported:
  - Video split into small segments (2-10 seconds each)
  - Each segment is a standalone .ts file
  - Playlist file (.m3u8) lists all segments

  master.m3u8 (manifest):
    #EXTM3U
    #EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
    1080p/playlist.m3u8
    #EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720
    720p/playlist.m3u8
    #EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=854x480
    480p/playlist.m3u8

  1080p/playlist.m3u8:
    #EXTM3U
    #EXT-X-TARGETDURATION:10
    #EXTINF:10.0,
    segment_001.ts
    #EXTINF:10.0,
    segment_002.ts
    ...

DASH (Dynamic Adaptive Streaming over HTTP) — Google:
  - Similar concept: segments + manifest (MPD file)
  - More flexible, used by YouTube
```

### Adaptive Bitrate Streaming (ABR)

The key to smooth playback across varying network conditions:

```
How it works:
1. Client downloads master manifest (lists all quality levels)
2. Client measures its download speed
3. Client selects the highest quality that can play smoothly
4. If bandwidth drops → client switches to lower quality mid-stream
5. If bandwidth improves → client switches to higher quality

Example:
  User starts on WiFi (10 Mbps) → plays 1080p
  User moves to cellular (2 Mbps) → switches to 480p
  User enters tunnel (0.5 Mbps) → switches to 240p
  User exits tunnel (3 Mbps) → switches to 720p

  All seamless, no buffering! Segments are independent.

Client-side ABR algorithms:
  - Buffer-based: choose quality based on buffer level
  - Bandwidth-based: estimate bandwidth from recent download times
  - Hybrid: combine both signals
```

### CDN Strategy

Video streaming is 80%+ of internet traffic. CDN is essential:

```
CDN Architecture for Video:

┌────────────────────────────────────────────────┐
│                                                │
│        Origin (S3 – all video segments)        │
│                                                │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│    │ Regional │  │ Regional │  │ Regional │   │
│    │ Edge     │  │ Edge     │  │ Edge     │   │
│    │ US-East  │  │ EU-West  │  │ AP-South │   │
│    └─────┬────┘  └─────┬────┘  └─────┬────┘   │
│          │             │             │         │
│    ┌─────┴────┐  ┌─────┴────┐  ┌─────┴────┐   │
│    │ Local    │  │ Local    │  │ Local    │   │
│    │ PoPs     │  │ PoPs     │  │ PoPs     │   │
│    │ (100s)   │  │ (100s)   │  │ (100s)   │   │
│    └──────────┘  └──────────┘  └──────────┘   │
│                                                │
└────────────────────────────────────────────────┘

Popular videos → cached at edge PoPs (99% cache hit)
Less popular → cached at regional edges
Long-tail → fetched from origin (S3)

Cache strategy:
  - Hot videos (< 48 hours old): push to ALL edge locations
  - Warm videos: cache on demand at regional edges
  - Cold videos: serve from origin, cache if re-watched
```

### Video Metadata Storage

```
videos table (DynamoDB or PostgreSQL):
| Column | Type | Notes |
|--------|------|-------|
| video_id | UUID | Primary key |
| user_id | UUID | Uploader |
| title | VARCHAR(500) | |
| description | TEXT | |
| status | ENUM | uploading, processing, ready, failed |
| duration_sec | INT | |
| resolution | VARCHAR | Original resolution |
| manifest_url | VARCHAR | CDN URL to master.m3u8 |
| thumbnail_url | VARCHAR | CDN URL to thumbnail |
| view_count | BIGINT | Eventual consistency OK |
| created_at | DATETIME | |
| tags | JSON | ["tech", "tutorial"] |

Indexes: (user_id, created_at), (status), (created_at DESC) for feed
```

### Transcoding Architecture at Scale

```
500K videos/day × 6 quality levels = 3M transcoding jobs/day

Architecture:
┌──────────┐     ┌──────────────┐     ┌──────────────────┐
│ S3 Event │────▶│  Job Queue   │────▶│  Transcoder Pool │
│ (upload) │     │  (SQS)       │     │  (EC2 GPU/CPU)   │
└──────────┘     └──────────────┘     │                  │
                                      │  ┌────┐ ┌────┐   │
                                      │  │ W1 │ │ W2 │   │
                                      │  └────┘ └────┘   │
                                      │  ┌────┐ ┌────┐   │
                                      │  │ W3 │ │ W4 │   │
                                      │  └────┘ └────┘   │
                                      └──────────────────┘

Each worker:
  - Pulls job from SQS
  - Downloads raw video segment from S3
  - Transcodes using FFmpeg (GPU-accelerated)
  - Uploads result to processed S3 bucket
  - Marks job complete

Parallel processing:
  - Split video into chunks (e.g., 30-second segments)
  - Transcode each chunk independently on different workers
  - Reassemble after all chunks are done
  - A 10-minute video → 20 chunks → processed in parallel → done in minutes

Cost optimization:
  - Use EC2 Spot Instances for transcoding (70% cost savings)
  - If spot instance is reclaimed, job retries on another instance
  - GPU instances (g4dn) for H.265/AV1 encoding
```

### Video Playback Flow

```
1. Client opens video page
2. Client requests: GET /api/v1/videos/vid_123
3. Server returns metadata including manifestUrl
4. Client fetches master.m3u8 from CDN
5. Client reads available quality levels
6. Client estimates bandwidth → selects initial quality (e.g., 720p)
7. Client fetches 720p/playlist.m3u8
8. Client starts downloading segments sequentially:
   - Download segment_001.ts → buffer → play
   - Download segment_002.ts → buffer
   - (Stays 2-3 segments ahead = buffer)
9. If bandwidth changes → switch quality level
10. Continue until video ends

Time to first frame: ~1-2 seconds
  (download manifest + first segment only)
```

### Cost Optimization

```
Video streaming costs are dominated by:

1. Storage: $0.023/GB/month (S3)
   - Use S3 Intelligent-Tiering for rarely accessed videos
   - Delete failed/abandoned uploads after 24 hours
   - Only keep 6 quality levels for recent videos; archive 4K after 1 year

2. Transcoding: $0.015-0.045/minute of output
   - Use spot instances (70% savings)
   - Don't transcode to 4K if source is 720p
   - Skip transcoding for videos with < 10 views (transcode on demand)

3. CDN Bandwidth: $0.085/GB
   - 80% of views are on 20% of videos → CDN cache hit ratio ~95%
   - Negotiate volume CDN pricing
   - Use origin shield to reduce origin fetches

4. Long-tail optimization:
   - Popular videos: pre-transcode all qualities, push to CDN
   - Medium: transcode all qualities, cache on demand
   - Rare: keep only 480p + 720p, transcode others on demand
```

---

## Step 4 — Wrap Up

### Architecture Summary

```
Upload Flow:
  Client → API (get pre-signed URL) → S3 (raw) → SQS → Transcoder Pool
    → S3 (processed) → CDN (edge cache)

Streaming Flow:
  Client → CDN (edge) → manifest + segments → Adaptive Bitrate Player
    → Smooth playback at best possible quality

Metadata Flow:
  Client → API Server → Video DB (DynamoDB/PostgreSQL)
```

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Upload method | Pre-signed S3 URLs | No proxy overhead, direct upload |
| Transcoding | Parallel chunk processing | Speed: 10-min video done in 2 min |
| Streaming | HLS + Adaptive Bitrate | Universal support, smooth quality switching |
| Storage | S3 (tiered) | Infinite scale, cost tiers |
| Delivery | Multi-tier CDN | Low latency worldwide |
| Compute | GPU spot instances | 70% cost savings for transcoding |

### Additional Talking Points

- **Live streaming** — Different pipeline: RTMP ingest → real-time transcoding → HLS/DASH with 3-10 sec latency
- **DRM (Digital Rights Management)** — Widevine (Google), FairPlay (Apple) for content protection
- **Content moderation** — ML models scan uploads for violence, NSFW, copyright (Content ID)
- **Recommendations** — Collaborative filtering + content-based, deep learning models (YouTube's deep neural networks)
- **Watch history & resume** — Store last watched position per (user, video) for resumption
- **Subtitles/captions** — Auto-generate with speech-to-text (Whisper), store as WebVTT files
- **Analytics** — Video engagement: watch time, completion rate, re-watches, buffer ratio
- **Multi-audio tracks** — Netflix: multiple language audio tracks per video
