# Meerkat - Note-taking and real-time collaboration for your crew. Voice, text, solo, or together.

A modern, real-time collaborative workspace platform featuring voice messaging with mood and tone analysis.

## 🚀 Features

- **Real-time Collaboration**: Built on Yjs CRDT for conflict-free synchronization
- **Voice Messages**: Record, playback, and analyze voice messages
- **Mood & Tone Analysis**: Automatic detection of emotional content in voice messages
- **Block-based Editor**: Flexible content blocks (text, headings, lists, voice, images, etc.)
- **Workspaces**: Organize content into separate workspaces
- **User Presence**: See who's online and where they're working
- **Comments & Threads**: Discuss content with threaded comments
- **Offline-first**: Work offline with automatic sync when reconnected

## 👥 Who Is Meerkat For?

**No matter your group size, Meerkat adapts to your needs - from one person standing guard alone to a whole mob watching out for each other.**

## 🏗️ Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animation**: Framer Motion
- **CRDT**: Yjs
- **Monorepo**: PNPM + Turborepo
- **API**: tRPC
- **Database**: PostgreSQL (Supabase)
- **ORM**: Prisma
- **Storage**: Supabase Storage
- **Realtime**: Supabase Realtime + Yjs WebSocket
- **Deployment**: Vercel

## 📁 Project Structure

```
meerkat/
├── apps/
│   └── web/                    # Main Next.js application
├── packages/
│   ├── shared/                 # Shared utilities
│   ├── crdt/                   # CRDT implementation (Yjs)
│   ├── voice/                  # Voice recording/playback
│   ├── mood-analyzer/          # Mood/tone analysis wrapper
│   ├── database/               # Prisma ORM + Supabase
│   └── ui/                     # Shared UI components
└── supabase/                   # Supabase configuration
```

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- PNPM >= 8.0.0
- Supabase account
- Vercel account (for deployment)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/meerkat.git
   cd meerkat
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up your private mood analyzer package**
   
   Make sure your `mood-and-tone-analyzer` repository is accessible:
   ```bash
   # Option 1: Local development
   cd packages/mood-analyzer
   pnpm add file:../../../mood-and-tone-analyzer
   
   # Option 2: Private npm registry
   pnpm add hari2309s-mood-tone-analyzer@latest --registry=<your-registry>
   
   # Option 3: GitHub private repository
   pnpm add git+https://github.com/hari2309s/mood-and-tone-analyzer.git
   ```

4. **Set up Supabase**
   
   a. Create a new project at [supabase.com](https://supabase.com)
   
   b. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example apps/web/.env.local
   ```
   
   c. Fill in your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   DATABASE_URL=your-database-url
   DIRECT_URL=your-direct-url
   ```

5. **Initialize the database**
   ```bash
   # Generate Prisma client
   pnpm db:generate
   
   # Run migrations
   pnpm db:push
   ```

6. **Run the development server**
   ```bash
   pnpm dev
   ```

7. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🗄️ Database Setup

### Using Supabase CLI (Recommended)

```bash
# Install Supabase CLI
pnpm add -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

### Manual Setup

1. Go to your Supabase project's SQL Editor
2. Copy and paste the contents of `supabase/migrations/20240101000000_initial_schema.sql`
3. Execute the SQL

## 📦 Package Scripts

```bash
# Development
pnpm dev              # Start all apps in development mode
pnpm dev:web          # Start only the web app

# Building
pnpm build            # Build all packages and apps
pnpm type-check       # Type check all packages

# Database
pnpm db:generate      # Generate Prisma client
pnpm db:push          # Push schema to database
pnpm db:migrate       # Run migrations
pnpm db:studio        # Open Prisma Studio

# Linting & Formatting
pnpm lint             # Lint all packages
pnpm format           # Format code with Prettier

# Cleaning
pnpm clean            # Clean all build artifacts
```

## 🔧 Configuration

### Tailwind CSS

Tailwind is configured at the workspace level and shared across packages. The configuration includes:

- Custom color scheme with mood/tone colors
- Animation utilities for voice recording
- Custom scrollbar styles
- Framer Motion integration

### tRPC

tRPC is set up for type-safe API calls. Add new routers in `apps/web/lib/trpc/routers/`.

Example:
```typescript
// apps/web/lib/trpc/routers/example.ts
export const exampleRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => {
      return { greeting: `Hello ${input.name}` };
    }),
});
```

### CRDT (Yjs)

Real-time collaboration is handled by Yjs. Documents are automatically persisted to IndexedDB and synced via WebSocket.

## 🎨 UI Components

The project uses Radix UI primitives with Tailwind CSS styling. Components are organized in the `packages/ui` package.

Key components:
- `VoiceRecorder`: Record voice messages
- `VoiceMessage`: Display and play voice messages with mood indicators
- Block editor components
- Collaboration UI (user presence, cursors)

## 🔐 Authentication

Authentication is handled by Supabase Auth. The middleware automatically:
- Refreshes user sessions
- Protects authenticated routes
- Syncs auth state across tabs

## 📡 Real-time Features

### CRDT Sync
- Uses Yjs for operational transformation
- Automatic conflict resolution
- Offline-first with eventual consistency

### Supabase Realtime
- Database change subscriptions
- Broadcast events for ephemeral data
- User presence

## 🎙️ Voice Message Flow

1. **Recording**: User records audio using `VoiceRecorder` component
2. **Upload**: Audio blob is uploaded to Supabase Storage
3. **Processing**: Server-side function triggers mood/tone analysis
4. **Analysis**: Private package analyzes audio for mood and tone
5. **Storage**: Results are cached in `voice_analysis_cache` table
6. **Display**: `VoiceMessage` component shows audio with mood indicator

## 🚀 Deployment

### Vercel (Recommended)

1. **Connect your repository**
   ```bash
   vercel login
   vercel link
   ```

2. **Set environment variables**
   
   In your Vercel project settings, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL`
   - `DIRECT_URL`

3. **Deploy**
   ```bash
   vercel --prod
   ```

### Manual Deployment

```bash
# Build all packages
pnpm build

# Deploy the web app
cd apps/web
vercel --prod
```

## 🧪 Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Generate coverage
pnpm test:coverage
```

## 📝 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `DIRECT_URL` | Direct PostgreSQL connection | Yes |
| `NEXT_PUBLIC_YJS_WEBSOCKET_URL` | WebSocket server URL | No |
| `OPENAI_API_KEY` | OpenAI API key (for transcription) | No |

## 🙏 Acknowledgments

- [Yjs](https://yjs.dev) for CRDT implementation
- [Supabase](https://supabase.com) for backend infrastructure
- [Vercel](https://vercel.com) for hosting
