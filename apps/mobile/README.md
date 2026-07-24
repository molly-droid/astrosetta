# Astrosetta Mobile App

React Native mobile app built with Expo.

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac) or Android Emulator

### Installation

```bash
# Install dependencies (from monorepo root)
pnpm install

# Navigate to mobile app
cd apps/mobile
```

### Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Add your Supabase credentials to `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=https://sqdpawyqvgqadflezxxk.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Running the App

```bash
# Start Expo development server
pnpm start

# Run on iOS simulator
pnpm ios

# Run on Android emulator
pnpm android

# Run in web browser
pnpm web
```

## Features

- **Chart Tab**: View and manage birth charts with interactive wheel visualization
- **Learn Tab**: Educational modules and XP progression system
- **Profile Tab**: Account settings and subscription management

## Architecture

- **Expo Router**: File-based routing
- **@astro/shared**: Shared business logic (hooks, Supabase client)
- **@astro/ui**: Shared UI components (ChartWheel)
- **React Native SVG**: Chart visualization

## Development

```bash
# Type checking
pnpm typecheck
```

## Building

```bash
# Build for production
eas build --platform ios
eas build --platform android
```
