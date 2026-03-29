# ZEIF

*Seguridad inteligente en tiempo real para grandes cadenas.*

Zeif transforma las camaras de seguridad existentes en detectores de hurto con inteligencia artificial. Sin reemplazar infraestructura, sin agregar hardware: cada camara analiza el comportamiento de los clientes y alerta automaticamente cuando detecta una situacion de riesgo.

Escalable a cientos de sucursales con visibilidad centralizada en un solo dashboard. En menos de 24 horas, las camaras que ya tenes empiezan a trabajar para vos.

> *Equipo Skynet* — Candela Mena, Cielo Dahy, Julian Melmer Stiefkens y Valentina Laura Correa

[![Deploy](https://img.shields.io/badge/deploy-zeif.vercel.app-black?style=flat-square)](https://zeif.vercel.app/)

---

## Como funciona


Camara ──> Frames continuos ──> Movimiento? ──> Scoring ──> Vision AI ──> Alerta + Face ID
                                (infrarrojo)    (avg>=0.6)  (¿robo?)


1. *Captura continua* — Las camaras del local capturan frames de forma permanente
2. *Deteccion de movimiento* — Un procesamiento por infrarrojo filtra las escenas sin actividad, evitando consumo innecesario de IA
3. *Scoring* — Si hay movimiento, ~150 frames se evaluan con un modelo de scoring. Solo las secuencias con un promedio >= 0.6 avanzan
4. *Clasificacion* — Un modelo de computer vision analiza la secuencia completa y determina si se trata de un robo
5. *Respuesta* — Si se confirma un robo, se vectoriza el rostro del sospechoso, se almacena en la base de datos, y se disparan alertas en tiempo real. Los frames negativos nunca se almacenan

---

## Tech Stack

| Capa | Tecnologia |
|------|------------|
| Framework | [Next.js 15](https://nextjs.org/) + [React 19](https://react.dev/) |
| Lenguaje | TypeScript 5.8 (strict mode) |
| IA | [OpenAI GPT-4.1](https://platform.openai.com/) + text-embedding-3-small |
| Backend | [Supabase](https://supabase.com/) (PostgreSQL + pgvector, Auth, Storage) |
| Estilos | [Tailwind CSS 4](https://tailwindcss.com/) + [Framer Motion](https://motion.dev/) |
| Testing | [Vitest](https://vitest.dev/) |
| Package Manager | pnpm |

---

## Inicio rapido

### Prerequisitos

- Node.js 18+
- pnpm
- Una API key de [OpenAI](https://platform.openai.com/)
- (Opcional) Proyecto en [Supabase](https://supabase.com/)

### Setup

bash
# 1. Clonar el repositorio
git clone https://github.com/tu-org/zeif.git
cd zeif

# 2. Instalar dependencias
pnpm install

# 3. Configurar variables de entorno
cp .env.example .env.local


Edita .env.local con tus credenciales:

env
OPENAI_API_KEY=tu-api-key
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key


bash
# 4. Levantar el servidor de desarrollo
pnpm dev


La app estara disponible en http://localhost:3000.

---

## Scripts

| Comando | Descripcion |
|---------|-------------|
| pnpm dev | Servidor de desarrollo |
| pnpm build | Build de produccion |
| pnpm lint | Chequeo de ESLint |
| pnpm type-check | Chequeo de TypeScript (strict) |
| pnpm format | Formatear con Prettier |
| pnpm test | Correr tests con Vitest |

---

## Arquitectura


zeif/

├── src/

│   ├── app/                      # Next.js App Router

│   │   ├── page.tsx              # Dashboard (grilla de cámaras)

│   │   ├── floor-view/           # Vista de planta con grabación

│   │   ├── face-db/              # Base de datos de rostros

│   │   └── api/

│   │       ├── analyze-video/    # Endpoint de análisis de video

│   │       └── faces/            # Endpoints de face matching

│   ├── components/

│   │   ├── app-shell.tsx         # Layout (sidebar + topbar + actividad)

│   │   ├── dashboard.tsx         # Vista principal del operador

│   │   ├── camera-grid.tsx       # Grilla 3x2 de cámaras

│   │   ├── camera-card.tsx       # Feed individual de cámara

│   │   ├── activity-panel.tsx    # Panel de alertas en tiempo real

│   │   ├── face-db-view.tsx      # Vista de sospechosos

│   │   └── sidebar.tsx           # Navegación lateral

│   ├── lib/

│   │   ├── openai/               # Integración con OpenAI

│   │   │   ├── analyze-video.ts  # Extracción de frames → GPT-4.1

│   │   │   └── face-capture.ts   # Captura facial + embeddings

│   │   ├── frame-extractor.ts    # Extracción de frames con FFmpeg

│   │   ├── types.ts              # AnalysisResult, errores

│   │   ├── pipeline/             # Pipeline de frames (hardware-agnostic)

│   │   │   ├── frame-provider.ts # Interface IZeifFrameProvider

│   │   │   └── zeif-frame.ts     # Tipo normalizado de frame

│   │   └── supabase/             # Cliente de Supabase (server-side)

├── supabase/

│   └── migrations/               # Esquema: tenants, incidents, audit_logs...

├── specs/                        # Especificaciones por feature

└── public/

│   └── videos/                   # Clips demo para la UI

---

## Pipeline de deteccion

### Como funciona el MVP

El prototipo implementa una version simplificada del pipeline para validar las piezas clave del sistema. El operador graba un clip desde el navegador, el backend extrae frames con FFmpeg y los envia a GPT-4.1 para clasificacion. Si se detecta un robo, se captura una descripcion facial del sospechoso, se genera un embedding con text-embedding-3-small y se almacena en Supabase con pgvector para busqueda por similitud.

Este flujo demuestra la viabilidad de la clasificacion por vision, la captura facial y el matching por embeddings, pero opera de forma manual y on-demand.

### Pipeline de produccion

La arquitectura objetivo opera de forma continua y autonoma en tres etapas:


                          Etapa 1                    Etapa 2                    Etapa 3
Camara ──> Captura continua ──> Deteccion de ──> Scoring model ──> Modelo de vision ──> Triggers
           de frames            movimiento       (avg >= 0.6?)     (¿es un robo?)
                                (infrarrojo)          │                    │
                                    │                 │              (si positivo)
                                    │            Si no supera            │
                               Si no hay         el umbral         ┌─────┴──────┐
                               movimiento            │             │            │
                                    │           Descarte       Vectorizar   Otros triggers
                               Descarte                        rostro      (alertas, etc.)
                                                                  │
                                                            Guardar en DB
                                                            (pgvector)


*Etapa 1 — Deteccion de movimiento.* Las camaras capturan frames de forma continua. Un procesamiento por infrarrojo determina si hay movimiento en la escena. Si no hay actividad, los frames se descartan sin consumir recursos de IA.

*Etapa 2 — Scoring.* Cuando se detecta movimiento, se acumulan ~150 frames y se pasan por un modelo de scoring que evalua cada frame individualmente. Se calcula el promedio de los scores: si es *>= 0.6*, la secuencia pasa a la siguiente etapa. Si no supera el umbral, se descarta.

*Etapa 3 — Clasificacion y respuesta.* Un modelo de computer vision analiza la secuencia completa para determinar si se trata de un robo. Si la clasificacion es positiva:
- Se vectoriza la imagen del sospechoso y se almacena como embedding en la base de datos (pgvector)
- Se disparan los triggers configurados (alertas en tiempo real, notificaciones, preservacion de evidencia)

> [!NOTE]
> El adaptador IZeifFrameProvider garantiza que ningun tipo vendor de camara penetre mas alla de la capa de adaptacion. El sistema es completamente *hardware-agnostic*.

---

## Vistas de la aplicacion

### Dashboard
Grilla 3x2 de camaras en tiempo real con indicadores de estado (LIVE / ACTIVE / OFFLINE), bounding boxes sobre detecciones, y estadisticas rapidas del local.

### Floor View
Vista alternativa de planta con capacidad de grabacion directa desde el navegador.

### Face DB
Base de datos de rostros sospechosos con niveles de riesgo (alto/medio/bajo), historial de incidentes, y estado de presencia activa en el local.

### Panel de Actividad
Feed lateral de alertas en tiempo real categorizadas por tipo: face match, ocultamiento, y sospecha.

---

## Principios de diseno

| Principio | Descripcion |
|-----------|-------------|
| *Proactive Detection* | Cada frame se clasifica o descarta. Sin almacenamiento innecesario |
| *Hardware-Agnostic* | Adapters normalizan; el core nunca ve tipos de vendor |
| *Trigger-Driven* | Triggers independientes, testeables y componibles |
| *Fail-Safe* | Silencio != "todo bien". Fallo critico = alerta en todos los canales |
| *Low-Latency* | Frame a clasificacion en <= 200ms |
| *Evidence Preservation* | Solo se persisten frames con deteccion positiva |

---

## Deploy

La aplicacion esta deployada en [Vercel](https://vercel.com/):

**[https://zeif.vercel.app](https://zeif.vercel.app/)**

---

## Video

Proximamente
