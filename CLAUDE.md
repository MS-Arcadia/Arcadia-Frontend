# Arcadia Frontend — Agent Rules

You are a **senior frontend engineer** working on the Arcadia storefront, the web client for a
twelve-service game distribution platform, reached through a gateway. Read this file in full before
writing or editing any code.

> `AGENTS.md` in this repo also applies: this is **Next.js 16**, whose APIs differ from most training
> data. `params` and `searchParams` are promises, `middleware` is now `proxy`, and Turbopack is the
> default. When unsure, read `node_modules/next/dist/docs/` rather than guessing.

## App identity

|          |                                                                           |
| -------- | ------------------------------------------------------------------------- |
| App name | **Arcadia** — use this in all UI copy                                     |
| Language | **English only.** LTR. No Persian in the UI, even though the spec is      |
| Currency | IRR, integer minor units, **string on the wire** — see `lib/money.ts`     |
| Theme    | **Dark only.** `dark` is hard-coded on `<html>`; there is no theme toggle |
| Platform | **Desktop-first**, fully responsive, installable as a PWA                 |

Desktop-first is a real constraint, not a preference: the sidebar rail is the primary navigation and
the mobile bottom bar is its reduction. Design at `lg` and up first, then check it works on a phone —
not the other way round.

## Tech stack (do NOT swap or add alternatives)

| Concern         | Library                                                              |
| --------------- | -------------------------------------------------------------------- |
| Framework       | Next.js 16 (App Router, Turbopack, React Compiler on)                |
| Language        | TypeScript 5, strict, `target: ES2020` (BigInt literals are used)    |
| React           | React 19                                                             |
| Styling         | Tailwind CSS v4 + CSS variables                                      |
| UI primitives   | shadcn/ui `base-nova` style → `components/ui/`, built on **Base UI** |
| Data fetching   | TanStack Query v5                                                    |
| Global state    | Zustand v5                                                           |
| Forms           | React Hook Form + `@hookform/resolvers` + Zod                        |
| HTTP client     | Axios (`services/http.ts`) — never use `fetch` directly              |
| Icons           | `lucide-react` only                                                  |
| Animations      | `motion` (Framer Motion v12)                                         |
| Toasts          | `sonner`                                                             |
| Package manager | `pnpm`                                                               |

**This shadcn style is Base UI, not Radix.** Two consequences that will bite:

- There is no `form.tsx`. The equivalent is `field.tsx`.
- Composition uses a `render` prop, not `asChild`. A `<Button>` that renders a `<Link>` also needs
  `nativeButton={false}`, or Base UI warns about losing native button semantics.

## Folder structure

```
app/
  (auth)/             signed-out: sign-in, sign-up. No shell, no wallet chip
  (app)/              signed-in: AuthGuard + sidebar + top bar + mobile bar
    page.tsx            store          /developer   developer's catalogue
    library/            owned games    /review      Support's review queue
    wallet/             balance+ledger /admin       accounts, roles, bans
    orders/[id]/        one order + instalment schedule
    games/[id]/         one game + the acquire panel
  offline/            what the service worker serves with no network
api/                  pure async functions — no hooks, no React
queries/              TanStack Query hooks, one file per api/ file
stores/               Zustand stores (*.store.ts)
hooks/                hooks not tied to one store or query
components/           shared components
  ui/                 shadcn primitives — modify sparingly
services/             http.ts and the mock backend
  mocks/              db.ts (state + rules) and adapter.ts (routes)
lib/                  pure helpers and constants
types/                *.api.type.ts for wire shapes, *.type.ts for app types
schemas/              Zod schemas (*.schema.ts)
providers/            React context providers
```

### Naming

- Files `kebab-case.tsx`; components `PascalCase`, named exports
- Query keys: exported object in `api/xyz.ts` (`catalogKeys`, `orderKeys`, …)
- Stores: `useXyzStore` (or a descriptive name) from `stores/xyz.store.ts`

## The backend, and how this app talks to it

Twelve services behind `api-gateway`, on `:8090` locally. Every path is written service-prefixed
against one base URL in `lib/api-paths.ts` — `/catalog/v1/games`, `/orders/v1/orders`, and so on —
and those prefixes are literally the gateway's own routing table (`api-gateway/internal/gateway/routes.go`),
so a path that is wrong here is wrong there too. Two environment variables decide what answers:

```
NEXT_PUBLIC_API_MODE=mock   # services/mocks answers, via a real axios adapter
NEXT_PUBLIC_API_MODE=live   # the gateway at NEXT_PUBLIC_API_URL answers (default local: http://localhost:8090)
```

**Never add a second base URL or a per-service axios instance.** `infra`'s `make images` now builds
this service's image with `API_MODE=live` by default, since the gateway exists; `make docker` in
this repository (no args) still builds the old self-contained `mock` image, useful for a demo with
no backend running. `pnpm dev` reads `.env.local`, which is not committed — set it to `live` plus the
gateway's address to develop against the real platform, or leave it `mock` to work with no backend
at all.

Ten of the gateway's twelve prefixes are wired up here — `auth`, `catalog`, `orders`, `wallet`,
`notifications`, `marketplace`, `reviews`, `festivals`, `community`, `recommendations` in
`lib/api-paths.ts`, each with a matching mock route in `services/mocks/adapter.ts`.

The two that are not:

- **`media-service`** has no paths, `api/` functions or hooks. Nothing here uploads a file. Game art
  arrives already-signed inside a game's `media[]`, and the Install button in the library is
  deliberately disabled with a tooltip saying why rather than wired to nothing.
- **`payment-service`** is reached by redirect, not by call. `POST /wallet/v1/charges` answers with a
  `redirect_url` and the browser follows it to the bank; the only frontend piece is the
  `/mock-bank/[intentId]` page, which stands in for that bank **under the mock only** — against a
  real platform the redirect goes to payment-service's own sandbox page instead.

Building a screen for either starts the way every existing one did: add the path to
`lib/api-paths.ts`, the function to `api/`, the hook to `queries/`, the wire types to `types/`, and a
route to `services/mocks/adapter.ts` — read the owning service's own README or DTO for its exact
request/response shape before writing the type, per the rule below.

### The mock layer is a real adapter, not a fixture folder

`services/mocks/adapter.ts` is installed as `http.defaults.adapter`, so a mocked request goes through
the same interceptors, the same RFC 7807 error mapping and the same `AxiosError` shape as a real one.
`services/mocks/db.ts` keeps state for the page session and **enforces the rules the services
enforce** — a purchase debits the wallet and fails when it is short, buying twice is refused, a
refund is refused after twelve hours.

When you add an endpoint: add the path to `lib/api-paths.ts`, the function to `api/`, the hook to
`queries/`, and a route to `adapter.ts`. If the mock disagrees with the service, the mock is wrong.

### Wire shapes are transcribed, never invented

Every type in `types/*.api.type.ts` was copied from the owning service's DTO. This matters more than
it sounds: the notification service shipped a bug because a test payload was written to match the
code instead of the producer, and the field names silently differed. If you need a shape that is not
in `types/`, read the service's DTO — do not infer it from a response you saw once.

## Roles

Four roles, and most of the interesting screens are gated by one:

| Role         | Can reach                                                           |
| ------------ | ------------------------------------------------------------------- |
| `BASIC_USER` | store, library, wallet, orders, notifications                       |
| `DEVELOPER`  | + `/developer` — register, build, submit, price, publish, discounts |
| `SUPPORT`    | + `/review` — start a review, approve, reject, suggest a price      |
| `ADMIN`      | + `/admin` — approve registrations, grant roles, suspend accounts   |

Gating is for **tidiness, not security**. Each page checks the role itself and every
service checks the token, so a hand-typed URL gets an explanation rather than a
blank screen. `useHasRole` exists for hiding links, never for protecting data.

While the mock is on, the sign-in form offers one account per role — see
`components/auth/demo-accounts.tsx`. That block disappears against a real auth
service, because then there are no known passwords to offer.

## The publishing workflow

Requirement 1.3 is a nine-state machine, and it is modelled as one — in
`services/mocks/db.ts` an illegal transition is a 409, not a no-op. That is what
makes the developer and Support screens meaningful: `publish` on an unpriced game
is refused, and `submit` on a game with no build is refused.

```
DRAFT → SUBMITTED → IN_REVIEW → APPROVED → PRICED → PUBLISHED
                        ↓                              ↕
                    REJECTED → APPEALED → IN_REVIEW  PREORDER
```

Render only the actions the current state allows. Showing every button and letting
the server refuse is correct and horrible to use.

## Money

`amount_minor` is a **string** holding an integer count of minor units, because a JS client truncates
integers above 2^53 and IRR amounts get there.

- Format with `lib/money.ts`. Never `Number(amount_minor) / 100`.
- Arithmetic is `BigInt`. Splitting is integer division; the remainder goes on the last part, which
  is how the order service builds an instalment schedule.
- Discounts are **basis points** (`discount_bps`): 2000 is 20%, 10000 is free.
- `effective_price` is what a buyer pays and is computed server-side. Never recompute it.
- Any element showing digits that will be compared down a column gets the `tabular` utility.

## Styling

- `cn()` from `@/lib/utils` for conditional classes.
- Colour comes from CSS variables only. `--primary` is **animated** — see the comment block at the
  top of `app/globals.css` — so never hard-code a hex that is meant to be the brand colour. The
  logo's six sampled stops are available as `brand-violet`, `brand-magenta`, `brand-coral`,
  `brand-apricot`, `brand-sky`, `brand-indigo`.
- **Use logical properties**: `ms-`/`me-`, `ps-`/`pe-`, `start-`/`end-`, `text-start`. The UI is LTR
  today and the whole layout was built so that direction is one attribute.
- Interactive elements get `min-h-11` (44px) where a finger will find them.
- Respect `prefers-reduced-motion` — the global rule handles it, so do not fight it with `!important`.

## Component rules

- **Default to Server Components.** `"use client"` only for hooks, handlers or browser APIs.
- Type props with a local `interface Props`. No `any`, no `React.FC<Props>`.
- No `useMemo`/`useCallback` to fight re-renders — the React Compiler is on.
- Pages stay thin: `page.tsx` re-exports a `_page.tsx` or a component.
- `next/image` always, with `fill` or explicit dimensions.
- Every query sets an explicit `staleTime`.
- Mutations that change money, ownership or notifications invalidate **all three** — see
  `useSaleInvalidation` in `queries/orders.ts`. A wallet left stale shows somebody money they spent.

## Copy

Write from the reader's side of the screen, in sentence case, active voice. Name a control by what
happens when it is used, and keep that name through the flow — the button that says "Buy now"
produces a toast that says "…is yours".

State names are the product's vocabulary and are not flattened: `PAYING` means "you have the game and
still owe for it", `DEFAULTED` means "the sale happened and ended badly". Collapsing the order states
into three would lose exactly what somebody opens the page to find.

Empty states say what will appear there and why. Errors say what happened and what to do; they do not
apologise.

## Do's and don'ts

| Do                                          | Don't                                        |
| ------------------------------------------- | -------------------------------------------- |
| `http` from `@/services/http`               | raw `fetch`, or a second axios instance      |
| `ls` from `@/lib/local-storage`             | `localStorage` directly                      |
| keys in `lib/storage-keys.ts`               | hard-coded storage key strings               |
| query keys from `api/*.ts`                  | inline `queryKey` arrays                     |
| `formatMoney()`                             | any arithmetic on `amount_minor` as a number |
| `lucide-react`                              | any other icon set                           |
| `render={<Link/>}` + `nativeButton={false}` | `asChild` (this is Base UI)                  |
| check `components/ui/` first                | re-implementing a primitive                  |
| `pnpm add`                                  | `npm` or `yarn`                              |

## Before writing code

1. Does a `components/ui/` primitive already cover this?
2. Does this belong in `api/`, `queries/` or `stores/` rather than in the component?
3. Is the wire shape already in `types/`? If not, read the service's DTO.
4. Am I about to do arithmetic on money? Use BigInt.
5. Does this need `"use client"`? Default to no.
6. Is there a mock route for the endpoint I am calling?

## Running it

```bash
pnpm dev         # http://localhost:3000, mock backend by default
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint
pnpm format      # prettier --write
pnpm build       # production build
```

Run `pnpm typecheck && pnpm lint` before considering any change done.
