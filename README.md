# Meerkat - Note-taking and real-time collaboration for your crew. Voice, text, solo, or together.

A modern, real-time collaborative workspace platform featuring voice messaging with mood and tone analysis.

![pnpm](https://img.shields.io/badge/pnpm-Workspace-orange?logo=pnpm)
![TurboRepo](https://img.shields.io/badge/TurboRepo-Monorepo-EF4444?logo=turborepo)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)
![tRPC](https://img.shields.io/badge/tRPC-API-2596BE?logo=trpc)
![Zod](https://img.shields.io/badge/Zod-Schema-3E67B1)
![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-Animations-0055FF?logo=framer)
![Vercel](https://img.shields.io/badge/Vercel-Hosting-black?logo=vercel)
![Tailwind](https://img.shields.io/badge/Tailwind-CSS-06B6D4?logo=tailwindcss)
![Yjs](https://img.shields.io/badge/Yjs-CRDT-orange)
![Supabase](https://img.shields.io/badge/Supabase-Auth_&_Storage-3ECF8E?logo=supabase)
![TweetNaCl](https://img.shields.io/badge/TweetNaCl-Encryption-5C4EE5)
![License](https://img.shields.io/badge/License-ISC-blue)

A note-taking and real-time collaboration app for your crew — voice, text, solo, or together. Your content lives on your device, encrypted by default. Visitors connect directly to you; when you're offline, the door closes.

## ✨ Features

- **Local-first Storage**: Notes and voice memos are written to IndexedDB first. The app works fully offline.
- **End-to-end Encryption**: All content is encrypted on-device via `@meerkat/crypto` before anything touches a network or storage.
- **Voice Memos**: Record, store, and play back voice notes — all within your den.
- **Block-based Editor**: Flexible content blocks — text, headings, lists, voice, and more.
- **On-device Mood Analysis**: Voice memo transcription and emotion classification run entirely in the browser. No audio is ever sent to a server.
- **CRDT Sync**: Conflict-free document synchronisation via Yjs, with a private/shared doc split.
- **Animated UI**: Smooth transitions and real-time feedback powered by Framer Motion.
- **Type-Safe Pipeline**: End-to-end TypeScript with Zod validation and shared types across the monorepo.

## 🏗️ Monorepo Structure

```
meerkat/
├── apps/
│   └── web/                # Next.js 15 application (App Router)
├── packages/
│   ├── crypto/             # All encryption — nothing leaves the device without passing through here
│   ├── local-store/        # IndexedDB-backed Yjs documents with private/shared doc split
│   ├── crdt/               # Orchestration layer — wires local-store together, exposes the den API
│   ├── voice/              # Voice recording, playback, and storage lifecycle
│   ├── types/              # Shared domain types across the monorepo
│   ├── ui/                 # Shared component library
│   ├── utils/              # General utilities (time formatting, UA parsing, etc.)
│   └── config/             # Environment validation and shared config
```

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- PNPM >= 8.0.0
- Supabase account (for auth and encrypted blob storage)
- Vercel account (for deployment)

### Installation

```bash
git clone https://github.com/hari2309s/meerkat.git
cd meerkat
pnpm install
```

### Environment Setup

```bash
cp apps/web/.env.example apps/web/.env.local
```

Fill in your Supabase project URL and anon key.

### Development

```bash
pnpm dev
```

### Build

```bash
pnpm build
```

## 🔐 How Privacy Works

Meerkat uses Supabase **only** for identity (auth) and encrypted blob storage. Your content never leaves your device unencrypted. The `@meerkat/crypto` package handles all key derivation and encryption before any data is persisted or uploaded.

## Screenshots

### Sign Up

![Sign up screen](docs/screenshots/signup.png)

### Dashboard

![Dashboard](docs/screenshots/dashboard.png)
