# 🏋️ Fitness Addict Unisex Gym — Gym Management System

An internal gym management web app built for **Fitness Addict Unisex Gym** to manage members, track payments, and monitor revenue.

## Tech Stack

- **Frontend:** React 19 + TypeScript
- **Build:** Vite
- **Styling:** TailwindCSS
- **Backend:** Supabase (Auth + PostgreSQL)
- **Hosting:** Vercel

## Features

- 🔐 **Secure Login** — Email/password auth via Supabase
- 📊 **Dashboard** — KPI cards, membership alerts, finance summary, today's revenue
- 👥 **Member Management** — Add, edit, renew, delete members with status tracking
- 💰 **Finance** — Revenue charts, transaction table, CSV export
- 📅 **Off-Day Calendar** — Mark gym closure dates with reasons
- 🔍 **Search & Filter** — Search by name/phone + filter by Active/Due/Expired

## Run Locally

**Prerequisites:** Node.js 18+

```bash
npm install
npm run dev
```

Opens at `http://localhost:3000/`

## Environment Variables (Optional)

Create a `.env.local` file:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Deploy

```bash
npx vercel --prod
```

## Project Structure

```
├── App.tsx                 # Root component + routing
├── index.tsx               # Entry point
├── types.ts                # TypeScript interfaces
├── components/
│   └── Layout.tsx          # Sidebar + responsive shell
├── pages/
│   ├── Login.tsx           # Authentication
│   ├── Dashboard.tsx       # KPI + alerts + finance summary
│   ├── Members.tsx         # Member cards + renew/edit/payment modals
│   ├── AddMember.tsx       # Member onboarding form
│   ├── Finance.tsx         # Revenue analytics + transaction history
│   └── OffDays.tsx         # Calendar for gym off-days
├── services/
│   └── supabase.ts         # Supabase client
└── utils/
    └── statusUtils.ts      # Membership status calculator
```
