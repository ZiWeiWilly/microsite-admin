# Microsite Admin — User Guide

A walkthrough of every feature in the Microsite Generator, written for the people who actually use it day-to-day (PMs, marketers, affiliate ops). Read it once and you should know what the tool can do and exactly how to do it.

> **Who can use this tool?** Anyone with a `@klook.com` Google account. There is no separate access list — if your Google account is on Klook's domain, you can sign in.

---

## Table of contents

1. [What this tool does](#1-what-this-tool-does)
2. [Signing in](#2-signing-in)
3. [The Dashboard](#3-the-dashboard)
4. [Creating a new microsite](#4-creating-a-new-microsite)
   - [Step 1 — Basic Info](#step-1--basic-info)
   - [Step 2 — Review Settings](#step-2--review-settings)
   - [Step 3 — Watch it build](#step-3--watch-it-build)
5. [Editing a site with AI](#5-editing-a-site-with-ai)
   - [Submitting an edit](#submitting-an-edit)
   - [Reviewing the AI's changes](#reviewing-the-ais-changes)
6. [Tips, limits, and FAQ](#6-tips-limits-and-faq)

---

## 1. What this tool does

Microsite Admin turns one form submission into a fully deployed Klook affiliate landing page. Behind the scenes it:

1. Reads the Klook page you point it at and asks AI to recommend a currency, brand colors, and supported languages.
2. (Optionally) generates a "Powered by Klook" branded logo set with AI.
3. Creates a new GitHub repository from the microsite template.
4. Creates a matching Vercel project linked to that repo.
5. Triggers the build workflow on GitHub Actions.
6. Streams progress back to you in real time.

After a site is live, you can come back and ask the AI to make changes ("change the hero title", "make the CTA button orange"). Those changes go through a review step — preview first, approve only if you like it.

![Overview screenshot — dashboard with one finished and one in-progress site](./images/overview.png)

---

## 2. Signing in

1. Open the tool URL in your browser.
2. You'll be sent straight to the **Sign in** page.
3. Click **Sign in with Google** and pick your `@klook.com` account.
4. Personal Gmail accounts are rejected — you'll see *"Access denied. Only @klook.com Google accounts are allowed."* if you try.

![Sign-in page](./images/login.png)

You stay signed in across browser sessions. To switch accounts, click **Sign out** in the top-right of any page.

---

## 3. The Dashboard

The Dashboard (`/`) is the home page. It lists every microsite the team has generated, newest first.

![Dashboard with site list](./images/dashboard.png)

For each site you'll see:

| Element | What it means |
|---|---|
| **Status pill** | `Generating` (build in progress), `Editing` (AI edit in progress), `Ready` (live), `Failed` (something broke). |
| **Attraction name** | The display name you entered when creating the site. |
| **Domain** | The custom domain configured for the microsite. |
| **Created by · date** | Who generated the site and when. |
| **Open site ↗** | Opens the live site in a new tab (only shown once a deployment URL exists). |
| **View status** | Goes to the live progress page for that site. |
| **Edit with AI** | Starts the AI edit flow for that site (see [Section 5](#5-editing-a-site-with-ai)). |
| **Repo ↗** | Opens the underlying GitHub repository (for the technical team). |

> The list **auto-refreshes every 15 seconds** while any site is in `Generating` or `Editing`. You don't need to reload the page — just keep it open.

To start a new site, click **+ New site** in the top-right.

---

## 4. Creating a new microsite

Click **+ New site** on the Dashboard, or open `/new` directly. The form has two steps.

### Step 1 — Basic Info

![New site form, step 1](./images/new-step1.png)

| Field | Required | What to put |
|---|---|---|
| **Attraction Name** | Yes | The display name, e.g. `Ramayana Water Park`. Used by the AI for analysis and as the basis of the repo/Vercel project name. |
| **Klook Activity URL** | Yes | The full Klook activity page, e.g. `https://www.klook.com/activity/12345-...`. The AI reads this to recommend country / currency / colors / languages. |
| **Domain** | Yes | The custom domain for the microsite, e.g. `ramayana-waterpark.guide`. As you type, the tool **checks for duplicates on GitHub and Vercel** — a green ✓ means it's available, a red message means a project already exists with that name. |
| **Test (Vercel) / Production (Cloudflare)** | — | Choose where to deploy. Today only **Test (Vercel)** is enabled. The Production option is greyed out until Cloudflare is reconnected. |
| **Affiliate URL** | Yes | The Klook affiliate redirect link — every CTA on the generated site will point here. |
| **Head Scripts** | No | Paste any tracking snippets you want injected into `<head>` (Google Tag Manager, GA4, Hotjar, etc.). The HTML is inserted verbatim. |

#### Logo

You have two ways to provide logos. You can mix and match.

**Option A — Generate with AI** (recommended)

1. Click **Generate Logo with AI**. After a few seconds you'll see three previews:
   - **Navbar** — the logo shown in the navigation bar.
   - **Footer Dark** — light-colored variant for dark footers.
   - **Favicon** — the browser-tab icon.
2. Don't like the result? Type a refinement in the chat box (*"make it more vibrant"*, *"use a temple silhouette"*, *"more minimal"*) and click **Refine**. The AI iterates on the previous version.
3. Click **Regenerate from Scratch** if you want to throw away the chat history and start over.

![Logo generation panel with refinement chat](./images/logo-generate.png)

**Option B — Upload manually**

Use the three file pickers near the bottom (Logo Navbar, Logo Light, Logo Icon). A manually uploaded file overrides the AI version for that slot. Click **Use AI version** beside any preview to revert.

> Logos must be image files. PNG with transparent background works best for the navbar and footer.

When everything looks right, click **Auto Settings →**. The AI will analyze your Klook URL and pre-fill the next step.

### Step 2 — Review Settings

![Step 2 — settings review](./images/new-step2.png)

The page shows a green badge like *"Auto-configured for Thailand"* so you know the AI's best guess. If it shows *(best guess)*, double-check the values below.

| Setting | What it does |
|---|---|
| **Base Currency** | Pick from 17 options (THB, USD, EUR, JPY, CNY, KRW, TWD, HKD, SGD, MYR, PHP, IDR, VND, INR, RUB, AUD, GBP). This is what prices on the site default to. |
| **Brand Colors** | Three color pickers — Primary, Secondary, Accent. Click each swatch to change. Used across CTAs, accents, and highlights on the generated site. |
| **Languages** | Click chips to toggle. **English is always on.** Available: 简体中文, 繁體中文, 日本語, 한국어, ไทย, Bahasa Melayu, Bahasa Indonesia, Tiếng Việt, हिन्दी, Русский, العربية, Deutsch, Français, Español, Português, Italiano, Nederlands, Türkçe, ລາວ. |

Need to fix the basic info? Click **← Edit basic info** to go back. Otherwise click **Generate Site →**.

### Step 3 — Watch it build

After you click **Generate Site →** you're redirected to the status page (`/status?repo=...`). It refreshes every 10 seconds — keep it open or come back to it from the Dashboard at any time.

![Status page showing build progress](./images/status-generating.png)

You'll see:

- A status pill (**In Progress** / **Completed** / **Failed**) and an elapsed timer.
- A progress bar showing what percent of steps are done.
- A checklist of friendly step names — *Cloning template repository*, *Applying your configuration*, *Generating site content with AI ✨*, *Building site*, *Generating sitemap*, *Saving generated content*, *Deploying to Vercel*. The currently running step is highlighted in amber.

**When it succeeds:**

```
Your site is live!
https://ramayana-waterpark.guide →
[ ✨ Edit this site with AI ]
```

It can take a few extra minutes for DNS / Vercel to fully propagate. If the link 404s, wait a bit and refresh.

**When it fails:** you'll see a red box telling you to contact the technical team. The detailed error log lives in GitHub Actions; your engineering partner can dig in.

> **"No workflow run yet"** — A specific failure mode you might see. It means the repo was created but GitHub Actions never started. The technical team needs to fix the GitHub token's permissions.

---

## 5. Editing a site with AI

Once a site is `Ready`, you can ask the AI to change anything on it — copy, layout, colors, components — without touching code.

There are two entry points:

- From the Dashboard, click **Edit with AI** on the site card.
- From a successful generation status page, click **✨ Edit this site with AI**.

Both land you on `/edit` with the repo and live URL pre-filled.

### Submitting an edit

![Edit form with three numbered inputs](./images/edit-form.png)

The form has three inputs:

**1. Page URL** *(required)* — The exact URL of the page you want changed, including locale and path:
```
https://ramayana-waterpark.guide/tw/tours/12345-something
```
This tells the AI which route in the codebase to modify.

**2. Where on the page** *(optional)* — Two ways to point the AI at the right area, and you can use either or both:
- **Upload a screenshot.** Mark it up first in Preview, Snagit, or browser DevTools (draw arrows / circles / boxes around the part you want changed) and drop it in. Max **5 MB**.
- **Describe it in words**, e.g. *"the hero section at the top"*, *"the second testimonial card"*, *"the sticky footer CTA"*.

**3. What to change** *(required)* — Plain English. Be specific:
- ✅ *"Change the hero title to 'Discover Tokyo' and make the CTA button orange (#f97316)."*
- ✅ *"In the FAQ, replace the third question with: 'Is the park wheelchair accessible?' and a 2-sentence answer."*
- ❌ *"Make it look better"* — too vague, results vary wildly.

Click **Apply AI Edit**. You're redirected to the status page in **edit mode**.

### Reviewing the AI's changes

![Edit status page with preview and Approve / Refine / Discard buttons](./images/status-edit.png)

The status page now shows AI-edit-specific steps: *Cloning your repository*, *Preparing edit branch*, *Loading your reference screenshot*, *AI is editing your site ✨*, *Committing changes*, *Opening pull request*.

When the workflow finishes you'll see **AI changes are ready for review** along with three actions:

| Action | What happens |
|---|---|
| **Open preview ↗** | Opens the Vercel preview deployment of the AI's branch — your changes live, isolated from production. The button is enabled only once Vercel reports the preview as `READY`. |
| **Approve & Merge** | Merges the AI's pull request into `main`. Production redeploys automatically. Use only after you've checked the preview. |
| **Refine** | Opens an extra form so you can give follow-up instructions. The AI continues on the **same branch** — your previous changes are preserved and built on. Use this to iterate ("the orange is too bright, try `#fb923c`"). |
| **Discard** | Closes the PR and deletes the branch. Your live site is untouched. Pops up a confirmation prompt first. |

You can also click **Open PR** to view the underlying GitHub pull request if you want a code-level diff (typically only useful for engineers).

> **Preview shows "UNAVAILABLE"** — Means the admin tool isn't configured with a Vercel token. You can still Approve & Merge, but you're approving without seeing the result first. Ask the technical team to add `VERCEL_TOKEN` to fix this.

---

## 6. Tips, limits, and FAQ

**Q. The Domain field shows red — what now?**
A project with that name already exists on GitHub or Vercel. Either pick a different domain, or ask the technical team to clean up the leftover project.

**Q. Can I generate without a Klook URL?**
Technically you need one for the AI to recommend country / currency / languages. If you skip the URL the form won't submit (it's required).

**Q. Why is the "Production (Cloudflare)" option greyed out?**
That deployment target is currently disabled. All sites go to **Test (Vercel)** for now.

**Q. The AI gave me a logo I don't like — can I keep iterating?**
Yes. Type a refinement in the chat box and click **Refine** as many times as you want. Each refinement builds on the previous version. Click **Regenerate from Scratch** to start over with a fresh prompt history.

**Q. How long does generation take?**
Usually 3–6 minutes end to end. AI content generation is the slowest step. You can close the tab — the site keeps building, and the Dashboard will reflect the final status whenever you come back.

**Q. Can I use this from my phone?**
You can sign in and view the Dashboard, but the New Site form really wants a desktop browser — file uploads and color pickers are awkward on mobile.

**Q. The AI edit didn't change what I asked.**
Two things to try:
1. **Be more specific** in the *What to change* box. Include exact text, exact colors (HEX), and where on the page.
2. **Add a marked-up screenshot.** A red circle around the right area is worth a lot of words.

If it's still off, click **Refine** instead of starting over — the AI will continue from where it left off rather than throwing away progress.

**Q. I approved by mistake.**
The merge has already pushed to production. Either submit a new AI edit to revert it, or ask the technical team to roll back via Vercel.

**Q. Where does my screenshot go?**
Screenshots you upload during AI edits are stored in Supabase so the GitHub Actions workflow can read them. They aren't shown publicly.

**Q. Who can edit a site I created?**
Any signed-in `@klook.com` user can edit any site. There's no per-site ownership today.

---

If something in this guide is wrong or out of date, ping the technical team and we'll update it.
