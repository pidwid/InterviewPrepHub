# InterviewPrepHub

A personal interview prep tracker built with React. Covers System Design and Low-Level Design topics with a structured roadmap, progress tracking, and integrated reference notes.

---

## What's in This Repo

```
InterviewPrepHub/
├── src/          ← React/Vite web app
├── Notes/        ← Reference notes (SD & LLD markdown files)
└── README.md     ← This file
```

---

## The App

### Overview

The app has two main sections, toggled via the top tab bar:

- **System Design (SD)** — caching, databases, load balancing, message queues, distributed systems, and more
- **Low-Level Design (LLD)** — OOP, SOLID principles, design patterns, concurrency, class design problems

Each section has four views:

| View | What it shows |
|---|---|
| **Roadmap** | A phased study plan. Click any topic to jump directly to it. |
| **Categories** | Topics grouped by category with a sidebar for navigation. |
| **Practice** | Practice questions. LLD questions are filterable by Easy / Medium / Hard / Concurrency / OOD. |
| **Index** | A flat list of all topics with your overall completion stats and a reset option. |

### Progress tracking

Each topic card has a status you can cycle through:

- **Not Started** (default)
- **Done** — studied and comfortable
- **Revise** — needs another pass

Progress is saved in your browser's `localStorage` — no backend or account needed. It persists across sessions automatically. To wipe progress for a section, use the reset button on the Index view.

### Notes

Clicking the note icon on a topic card opens the corresponding reference note as a rendered markdown page directly in the app. The raw markdown files live in `Notes/`:

```
Notes/
├── SystemDesign/     ← SD topic notes + solutions
├── LowLevelDesign/   ← LLD notes (OOP, SOLID, patterns, concurrency, cheat sheet)
└── Other/            ← General engineering notes (scalability, trade-offs)
```

---

## Running Locally

Requires Node.js.

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

```bash
npm run build     # Production build → dist/
npm run preview   # Preview the production build
npm run lint      # Run ESLint
```

---

## Tech Stack

- **React 19** + **Vite**
- **react-markdown** with `remark-gfm` and `rehype-raw` for rendering notes
- `localStorage` for persistence (no backend)
