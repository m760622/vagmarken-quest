# Vägmärken Quest

A game for learning Swedish traffic signs (Transportstyrelsen's official signs) in English, Swedish and Arabic.
Quiz with a 50/50 lifeline, Daily challenge, Blitz, Memory, Match, flashcards and a "review your mistakes" mode,
plus XP, levels, daily missions and badges. Installable as an app (PWA) and works offline after the first visit.

**Live:** https://m760622.github.io/vagmarken-quest/

## Run locally

```sh
npm ci
npm run dev        # http://localhost:8080
npm run build      # production build in dist/
```

## Notes

- Sign images live in `public/signs/<id>.png` (Transportstyrelsen's official graphics, treated as public domain;
  E1 and most later additions come from Wikimedia Commons, public domain, credit: Transportstyrelsen).
- Sign data (Swedish / English / Arabic names and descriptions) is in `src/constants/signs.ts`.
- Built with Vite, React, TypeScript, Tailwind CSS and shadcn/ui.
