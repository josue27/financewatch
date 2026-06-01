# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Next.js 16 (App Router) + React 19 + TypeScript 6 + Tailwind CSS 3 + Recharts 3 + yahoo-finance2 3.15

## Commands

```bash
npm run dev      # Start dev server (Turbopack)
npm run build    # Production build + type check
npm start        # Start production server
```

No test runner or linter is configured yet.

## Architecture

```
Browser (Client Component) → fetch → /api/stock?simbolo=X&historial=30 → lib/stock-data.ts → yahoo-finance2 → Yahoo Finance
```

### Data layer (`lib/stock-data.ts`)

Singleton `new YahooFinance()` instance. Three public async functions:

| Function | Yahoo Finance call | Returns |
|---|---|---|
| `obtenerStockInfo(symbol)` | `yahooFinance.quote()` | `StockInfo` (Spanish field names: `simbolo`, `nombre`, `precio`, `cambioPorcentaje`, etc.) |
| `obtenerStockHistorial(symbol, days)` | `yahooFinance.historical()` | `StockHistoryPoint[]` (`fecha`, `apertura`, `cierre`, `volumen`) |
| `obtenerStockCompleto(symbol, days)` | Both in parallel via `Promise.all` | `StockDataCompleto extends StockInfo + historial` |

Error mapping function `mejorarError()` translates yahoo-finance2 errors into Spanish user messages (not found, timeout, rate limit, network).

**Important**: yahoo-finance2 v3 types are imported from `yahoo-finance2/modules/quote` and `yahoo-finance2/modules/historical` (public export paths), **not** internal `esm/src/` paths.

### API Route (`app/api/stock/route.ts`)

Single `GET` endpoint. Query params: `simbolo` (required), `historial` (optional, defaults to 0 = disabled). Validates symbol with regex `/^[A-Za-z0-9.]{1,10}$/`. ISR cache via `export const revalidate = 60`. Returns `{ error: boolean, datos?: T, mensaje?: string }`.

### Frontend (`app/page.tsx`)

`"use client"` — uses `useState`, `useEffect`, `localStorage`. Key design decisions:

- **Symbol list persisted** in `localStorage` key `"financewatch-simbolos"`. Defaults: AAPL, MSFT, GOOGL, AMZN, TSLA. Max 10.
- **Parallel fetches** via `Promise.allSettled` when loading symbols (triggers on `simbolos.length` change).
- **Lazy history**: chart data fetched on click, not on initial load.
- **Strict Mode guard**: `useRef(cargadoRef)` prevents double mount fetch.
- **State shape**: `Record<string, EstadoAccion>` indexed by symbol, where `EstadoAccion = { simbolo, datos: StockInfo | null, cargando: boolean, error: string | null }`.

### Components

All are `"use client"`:

- **`StockCard`** — `React.memo` wrapped. Renders 3 states: skeleton (loading), error card (red), normal (price + green/red change %). Click toggles chart selection.
- **`SearchBar`** — Controlled input, auto-uppercase, real-time validation, Enter/Escape keyboard support. Calls `onAgregar` callback.
- **`StockChart`** — Recharts `ResponsiveContainer` → `LineChart` with `Brush` for zoom. Custom HTML tooltip via `TooltipContentProps` (Recharts v3 type). Color derived from trend (green if up, red if down). Reference line at initial price.

### Styling

Tailwind CSS v3 with custom dark theme colors in `tailwind.config.ts`:

| Token | Hex | Usage |
|---|---|---|
| `surface-dark` | `#0f172a` | Page background |
| `surface-card` | `#1e293b` | Card background |
| `surface-hover` | `#334155` | Selected card |
| `accent` | `#3b82f6` | Primary buttons |
| `market-green` | `#16a34a` | Positive change |
| `market-red` | `#dc2626` | Negative change |

Reusable CSS classes in `globals.css`: `.card-financiera`, `.btn-primario`, `.btn-secundario`, `.spinner`, `.animate-fade-in-up`.

## Code conventions

- Comments and user-facing messages in **Spanish**.
- Code identifiers in **English/Spanish mix**: function names in Spanish (`obtenerStockInfo`, `manejarAgregarSimbolo`), interface fields in Spanish (`simbolo`, `precio`).
- No eslint/prettier config — add before contributing back.
- yahoo-finance2 v3 requires `new YahooFinance()` instance; static methods are deprecated and typed as `never`.
