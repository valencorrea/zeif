# Zeif Database — Entity Relationship Diagram

## ER Diagram

```mermaid
erDiagram
    INCIDENTS ||--o| STORAGE : "clip stored in"
    ZONE_SEGMENTS ||--o{ INCIDENTS : "provides context to"

    INCIDENTS {
        uuid id PK
        bigint timestamp "Detection timestamp (epoch ms)"
        boolean confirmed "API Vision confirmed theft"
        real confidence "0-1 confidence score"
        text theft_type "shoplifting | pickpocket | none"
        text description "What the API saw"
        text clip_path "Path in Storage bucket"
        text zone_context "Zone info sent to API"
        timestamptz created_at "Auto-generated"
    }

    ZONE_SEGMENTS {
        uuid id PK
        text zone_id "Geographic zone identifier"
        text theft_type "shoplifting | pickpocket | none"
        real frequency "0-1 percentage of this type"
        timestamptz created_at "Auto-generated"
    }

    STORAGE {
        text bucket "evidence"
        text path "clips/incident-{id}-{ts}.mp4"
        text content_type "video/mp4"
    }
```

## Detection Pipeline Flow

```mermaid
sequenceDiagram
    participant Cam as Camera/Video
    participant Cls as Classifier (Stage 1)
    participant Buf as Frame Buffer (150)
    participant Enc as Encoder
    participant API as Vision API (Stage 2)
    participant DB as Supabase DB
    participant S3 as Supabase Storage
    participant UI as Owner Dashboard

    loop Every frame (30 FPS)
        Cam->>Cls: ZeifFrame
        Cls->>Buf: frame + score
        Buf->>Buf: Update rolling average
    end

    Note over Buf: avg score >= 0.6?

    alt Average >= 0.6 (suspicious)
        Buf->>Enc: 150 frames (5 seconds)
        Enc->>API: clip.mp4 + zone context
        alt Confirmed theft
            API->>S3: Upload clip.mp4
            API->>DB: INSERT incident
            DB->>UI: Show alert + 911 button
        else Not confirmed
            API->>DB: Log false positive
        end
    else Average < 0.6 (normal)
        Note over Buf: Continue buffering
    end
```

## RLS Policies

```mermaid
flowchart LR
    subgraph incidents
        IS[SELECT] -->|authenticated| Allow1[Allow]
        II[INSERT] -->|authenticated| Allow2[Allow]
    end

    subgraph zone_segments
        ZS[SELECT] -->|authenticated| Allow3[Allow]
        ZI[INSERT] -->|admin only| Allow4[Allow]
    end
```

## Notes

- View these diagrams on GitHub (renders Mermaid natively) or paste into [mermaid.live](https://mermaid.live)
- Storage is not a real table — it represents the Supabase Storage bucket
- The `zone_context` field in incidents is a text snapshot of the zone data at detection time, not a foreign key
