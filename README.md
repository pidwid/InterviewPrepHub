# InterviewPrepHub

A personal interview prep tracker for a 100-day structured study plan targeting a Backend Engineer role at Atlassian. It combines a React web app (for System Design and Low-Level Design tracking) with a set of daily markdown problem files and notes.

---

## What's in This Repo

```
InterviewPrepHub/
├── src/                    ← React/Vite web app (the tracker UI)
├── daily-problems/         ← 100 daily markdown files (DSA + backend tasks)
├── Notes/                  ← System design & LLD reference notes
├── PROGRESS.md             ← Weekly tracking sheet (fill in manually)
├── QUICK_START.md          ← Daily workflow guide
└── README.md               ← This file
```

There are two separate but complementary parts:

| Part | What it is | How you use it |
|---|---|---|
| **Web App** | React UI to track SD and LLD topic progress | Run locally in the browser |
| **Daily Files** | 100 markdown problem files, one per day | Open in any editor/markdown viewer |

---

## The Web App

### What it does

The app is a progress tracker with two main sections, toggled via the top tab bar:

- **System Design (SD)** — covers topics like caching, databases, load balancing, message queues, distributed systems, etc.
- **Low-Level Design (LLD)** — covers OOP design patterns, concurrency, class design problems, etc.

Each section has four views:

| View | Description |
|---|---|
| **Roadmap** | A phased study plan. Click a topic to jump straight to it. |
| **Categories** | Topics grouped by category, with a sidebar for quick navigation. |
| **Practice** | Practice questions (filterable by difficulty/type for LLD). |
| **Index** | A flat overview of all topics with your overall completion stats. |

### Tracking progress

Every topic card has a status you can cycle through:

- **Not Started** (default)
- **Done** — you've studied it
- **Revise** — needs another pass

Progress is saved in your browser's `localStorage` — no backend, no account needed. It persists across sessions automatically. You can reset a section from the Index view if you want a clean slate.

### Running it locally

Make sure you have Node.js installed, then:

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

Other commands:

```bash
npm run build     # Production build → dist/
npm run preview   # Preview the production build locally
npm run lint      # Run ESLint
```

---

## The 100-Day Study Plan

### Structure

The plan runs **Jan 20 – Apr 30, 2026** across four phases:

| Phase | Days | Dates | Focus |
|---|---|---|---|
| **Foundation** | 1–28 | Jan 20 – Feb 16 | DSA fundamentals, Spring Boot REST API, JPA/PostgreSQL |
| **Intermediate** | 29–56 | Feb 17 – Mar 16 | Advanced graphs, DP, microservices, Kafka, Redis |
| **Advanced** | 57–77 | Mar 17 – Apr 6 | Complex DP, LLD, Docker, Kubernetes, observability |
| **Interview Prep** | 78–100 | Apr 7 – Apr 30 | Mock interviews, system design practice, Atlassian-specific questions |

Leaves are built into the schedule (Feb 11–13, Mar 7–16).

### Daily routine

Each daily file (`daily-problems/Day-XX_YYYY-MM-DD.md`) is a self-contained 2.5–3 hour session:

```
DSA Practice      60 min   — Pattern study (15 min) + 2-3 LeetCode problems (45 min)
Backend Learning  45 min   — Concept + hands-on code
Project Work      30 min   — Incremental feature on the practice project
Daily Review      15 min   — Reflect, check off tasks, preview tomorrow
```

### How to follow the daily plan

1. Open today's file from `daily-problems/`
2. Work through each section top to bottom
3. Check off tasks as you complete them
4. At the end of the week, update `PROGRESS.md`

See [`QUICK_START.md`](./QUICK_START.md) for a detailed walkthrough of the daily workflow.

---

## Tracking Your Progress

[`PROGRESS.md`](./PROGRESS.md) is your manual tracking sheet. Update it each Sunday:

- Fill in the weekly summary table (days completed, problems solved, hours)
- Check off milestone items
- Add reflections and note weak areas

It also contains:
- A spaced repetition tracker (problems to revisit)
- A mock interview log
- A final pre-interview checklist

---

## Notes

The `Notes/` directory contains reference notes for:

- **System Design** — architecture patterns, trade-offs, real-world examples
- **Low-Level Design** — design patterns, OOP principles, concurrency
- **Other** — general engineering concepts

These notes are also surfaced directly in the web app — clicking a topic's note icon opens it as a rendered markdown page within the UI.

---

## Key Principles

1. **Consistency over intensity** — 2.5 hours daily beats marathon weekends
2. **No solutions first** — attempt problems for at least 15–20 minutes before checking hints
3. **Build real things** — the backend project is proof you can ship code
4. **Track weak areas** — use the spaced repetition tracker in `PROGRESS.md` to revisit hard topics
