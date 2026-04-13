# Microsite Admin

An internal tool for Klook employees to automate the creation of affiliate landing page microsites. After signing in with Google OAuth, fill in attraction details and the system will automatically create a GitHub repository, upload brand assets, trigger a CI/CD workflow, and deploy to Cloudflare Pages.

## Features

- Google OAuth login (restricted to `@klook.com` accounts)
- Two-step form: enter basic info → review settings
- AI-powered recommendations for currency, languages, and brand colors (via OpenRouter Gemini)
- Automatic GitHub repository creation from a template
- Logo and favicon upload to the repository
- GitHub Actions workflow dispatch
- Cloudflare Pages integration with automatic custom domain binding
- Real-time deployment status monitoring (polling every 10 seconds)

## Tech Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **NextAuth v5** + Google OAuth
- **GitHub API** — repository creation, secret management, workflow dispatch
- **OpenRouter AI** — intelligent settings recommendations
- **Cloudflare Pages API** — automated deployment and domain binding
- **libsodium-wrappers** — GitHub secret encryption

## Prerequisites

- Node.js 18+
- npm or pnpm

## Installation & Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the template and fill in the required values:

```bash
cp .env.example .env.local
```

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_CLIENT_ID` | Google OAuth app client ID | Yes |
| `GOOGLE_CLIENT_SECRET` | Google OAuth app client secret | Yes |
| `AUTH_SECRET` | NextAuth session encryption key (generate with `npx auth secret`) | Yes |
| `GITHUB_TOKEN` | GitHub Personal Access Token (needs repo and secrets permissions) | Yes |
| `TEMPLATE_OWNER` | GitHub owner of the template repository | Yes |
| `TEMPLATE_REPO` | Template repository name | Yes |
| `TARGET_OWNER` | GitHub owner where new repositories will be created | Yes |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID | No |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token (requires Pages: Edit permission) | No |
| `OPENROUTER_API_KEY` | OpenRouter API key (for AI recommendations) | No |

### 3. Start the development server

```bash
npm run dev
```

Runs at [http://localhost:3002](http://localhost:3002) by default.

## Usage

### Step 1: Sign In

Navigate to the app — you'll be redirected to the login page. Sign in with your `@klook.com` Google account.

### Step 2: Enter Basic Info

| Field | Description |
|-------|-------------|
| Attraction Name | Used for AI analysis and repository configuration |
| Klook URL | The attraction's Klook page URL, used for AI recommendations |
| Target Domain | The custom domain for the microsite (e.g. `example.com`) |
| Affiliate URL | The Klook affiliate link for the attraction |
| Logo (Navbar) | Logo image used in the navigation bar |
| Logo (Footer) | Light-colored logo image used in the footer |
| Favicon | Browser tab icon |

Click **Generate Settings** — the system will call the AI to auto-fill:

- Base currency
- Primary, secondary, and accent brand colors
- Recommended languages

### Step 3: Review Settings

Manually adjust any AI-recommended settings:

- **Currency** — choose from 17 currencies (THB, USD, EUR, JPY, etc.)
- **Brand Colors** — primary, secondary, accent (HEX codes)
- **Languages** — toggle supported languages (English is always included; options: Traditional Chinese, Simplified Chinese, Japanese, Korean, Malay, Vietnamese, German, French)

Click **Generate Site** to start the generation process.

### Step 4: Monitor Deployment

After generation begins, you'll be redirected to the status page showing:

- Per-job and per-step GitHub Actions status
- Live progress updates (refreshed every 10 seconds)
- The live site URL on success
- Error details and a link to the GitHub Actions run on failure

## Scripts

```bash
npm run dev      # Start development server (port 3002)
npm run build    # Build for production
npm run start    # Start production server
```

## Deployment

The project is configured for Vercel deployment with `output: 'standalone'` in `next.config.js`. Set all environment variables in the Vercel dashboard and push to `main` to trigger an automatic deployment.

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/recommend` | POST | AI-powered recommendations for currency, languages, and colors |
| `/api/generate` | POST | Creates the repository, uploads assets, and triggers the workflow |
| `/api/status` | GET | Polls GitHub Actions workflow status |
| `/api/auth/[...nextauth]` | GET/POST | NextAuth OAuth handlers |
