# Zeif Database — Entity Relationship Diagram

## ER Diagram

```mermaid
erDiagram
    TENANTS ||--o{ INCIDENTS : "owns"
    TENANTS ||--o{ AUDIT_LOGS : "generates"
    INCIDENTS ||--o{ AUDIT_LOGS : "tracked by"
    INCIDENTS ||--o| STORAGE : "clip stored in"

    TENANTS {
        uuid id PK "Supabase Auth user ID"
        text business_name "Name of the commerce"
        text zone_id "Geographic zone for context"
        text phone "Emergency contact number"
        timestamptz created_at "Auto-generated"
    }

    INCIDENTS {
        uuid id PK
        uuid tenant_id FK "Owner of the commerce"
        bigint timestamp "Detection timestamp (epoch ms)"
        boolean confirmed "API Vision confirmed theft"
        real confidence "0-1 confidence score"
        text theft_type "shoplifting | pickpocket | none"
        text description "What the API saw"
        text clip_path "Path in Storage bucket"
        text zone_context "Zone info sent to API"
        timestamptz created_at "Auto-generated"
    }

    AUDIT_LOGS {
        uuid id PK
        uuid tenant_id FK "Which tenant"
        uuid incident_id FK "Related incident (nullable)"
        text event_type "incident.created | system.api_failure | etc"
        text details "JSON with event-specific data"
        text actor "system | tenant | api"
        timestamptz created_at "Auto-generated"
    }

    STORAGE {
        text bucket "evidence"
        text path "clips/tenant-id/incident-id.mp4"
        text content_type "video/mp4"
    }
```

## Event Types

```mermaid
flowchart TD
    subgraph Incident Events
        IC[incident.created] --> |"avg score crossed 0.6"| I1[Clip captured]
        ICF[incident.confirmed] --> |"API said yes"| I2[Theft verified]
        IR[incident.rejected] --> |"API said no"| I3[False positive]
        ICS[incident.clip_saved] --> |"MP4 uploaded"| I4[Evidence stored]
        I911[incident.911_pressed] --> |"Owner pressed button"| I5[Emergency action]
    end

    subgraph System Events
        SAF[system.api_failure] --> |"Vision API down"| S1[Alert owner]
        SCD[system.classifier_down] --> |"Stage 1 offline"| S2[Alert owner]
    end

    subgraph Tenant Events
        TL[tenant.login] --> |"Owner logged in"| T1[Session started]
    end
```

## Multi-Tenant Data Flow

```mermaid
sequenceDiagram
    participant T as Tenant (Owner)
    participant Auth as Supabase Auth
    participant Cam as Camera
    participant Pipe as Detection Pipeline
    participant DB as Supabase DB
    participant S3 as Supabase Storage
    participant UI as Dashboard

    T->>Auth: Login
    Auth-->>T: JWT token
    Note over DB: audit_log: tenant.login

    loop Every frame (30 FPS)
        Cam->>Pipe: ZeifFrame
        Pipe->>Pipe: Classify + buffer + rolling avg
    end

    Note over Pipe: avg >= 0.6

    Pipe->>DB: INSERT incident (tenant_id)
    Note over DB: audit_log: incident.created
    Pipe->>S3: Upload clip (tenant_id/incident_id.mp4)
    Note over DB: audit_log: incident.clip_saved
    Pipe->>Pipe: Call Vision API

    alt Confirmed
        Pipe->>DB: UPDATE incident (confirmed = true)
        Note over DB: audit_log: incident.confirmed
        DB->>UI: Show alert
        T->>UI: Press 911 button
        Note over DB: audit_log: incident.911_pressed
    else Rejected
        Pipe->>DB: UPDATE incident (confirmed = false)
        Note over DB: audit_log: incident.rejected
    end
```

## RLS Policies

```mermaid
flowchart LR
    subgraph incidents
        IS[SELECT] -->|"tenant_id = auth.uid()"| A1[Own data only]
        II[INSERT] -->|"tenant_id = auth.uid()"| A2[Own data only]
    end

    subgraph audit_logs
        AS[SELECT] -->|"tenant_id = auth.uid()"| A3[Own logs only]
        AI[INSERT] -->|service role| A4[System only]
    end

    subgraph tenants
        TS[SELECT] -->|"id = auth.uid()"| A5[Own profile only]
        TU[UPDATE] -->|"id = auth.uid()"| A6[Own profile only]
    end
```

## Notes

- **Supabase Auth** handles tenant authentication — `tenants` table extends the auth user with business info
- **Storage** is not a real table — it represents the Supabase Storage bucket, organized by tenant_id
- **audit_logs.incident_id** is nullable — system events (api_failure, classifier_down) don't have an incident
- **audit_logs.details** is a JSON text field for event-specific data (error messages, scores, etc.)
- **RLS ensures tenant isolation** — each owner only sees their own incidents, logs, and profile
- View these diagrams on GitHub (renders Mermaid natively) or paste into [mermaid.live](https://mermaid.live)
