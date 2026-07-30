/**
 * The starting state of the stand-in backend.
 *
 * Separated from `db.ts` so the rules and the fixtures can be read independently.
 * Everything here is shaped like the real services' DTOs — see the note at the
 * top of `db.ts` for why that matters more than it sounds.
 */

import type { GameState } from "@/types/catalog.api.type"
import type { Role } from "@/types/common.api.type"
import type { UserState } from "@/types/auth.api.type"

export const CURRENCY = "IRR"
export const PLATFORM_SHARE_BPS = 3000
export const REFUND_WINDOW_HOURS = 12
export const GIFT_MESSAGE_FEE_BPS = 200

/** The signed-in person in the demo. A UUID because the wallet service stores
 *  `user_id` as `uuid` and rejects anything else. */
export const PLAYER_ID = "11111111-1111-4111-8111-111111111111"
export const DEVELOPER_ID = "22222222-2222-4222-8222-222222222222"
export const SUPPORT_ID = "33333333-3333-4333-8333-333333333333"
export const ADMIN_ID = "44444444-4444-4444-8444-444444444444"

export interface SeedUser {
  user_id: string
  email: string
  display_name: string
  role: Role
  state: UserState
  password: string
}

/**
 * Four accounts, one per role, so every screen in the app has somebody who is
 * allowed to use it. The passwords are here in plain sight on purpose: this is a
 * fixture file for a mock, and pretending otherwise would just make the demo
 * harder to sign into.
 */
export const SEED_USERS: SeedUser[] = [
  {
    user_id: PLAYER_ID,
    email: "player@arcadia.local",
    display_name: "Sam Player",
    role: "BASIC_USER",
    state: "ACTIVE",
    password: "player-password",
  },
  {
    user_id: DEVELOPER_ID,
    email: "dev@arcadia.local",
    display_name: "Nova Studio",
    role: "DEVELOPER",
    state: "ACTIVE",
    password: "dev-password",
  },
  {
    user_id: SUPPORT_ID,
    email: "support@arcadia.local",
    display_name: "Ada Support",
    role: "SUPPORT",
    state: "ACTIVE",
    password: "support-password",
  },
  {
    user_id: ADMIN_ID,
    email: "admin@arcadia.local",
    display_name: "Platform Admin",
    role: "ADMIN",
    state: "ACTIVE",
    password: "admin-password",
  },
  // Two people waiting on requirement 1.1's approval step, so the admin screen
  // opens with something to decide rather than an empty state.
  {
    user_id: "55555555-5555-4555-8555-555555555555",
    email: "hopeful@arcadia.local",
    display_name: "Rin Hopeful",
    role: "BASIC_USER",
    state: "PENDING",
    password: "hopeful-password",
  },
  {
    user_id: "66666666-6666-4666-8666-666666666666",
    email: "second@arcadia.local",
    display_name: "Kai Waiting",
    role: "BASIC_USER",
    state: "PENDING",
    password: "waiting-password",
  },
]

export interface GameSeed {
  title: string
  description: string
  genres: string[]
  price: number
  state: GameState
  cover: string
  developer: string
  discountBps?: number
  releaseInDays?: number
  /** A game in review needs a suggested price for the developer to react to. */
  suggestedPrice?: number
  rejectionNote?: string
}

/**
 * Eight published or pre-order games for the storefront, plus four belonging to
 * the demo developer at different points in the publishing workflow — one in each
 * of DRAFT, SUBMITTED, IN_REVIEW and APPROVED — so the developer and review
 * screens are not empty and the state machine is visible without doing data entry
 * first.
 */
export const SEED_GAMES: GameSeed[] = [
  {
    title: "Neon Drift",
    description:
      "A race through the wet streets of a city with no name. You see each corner once, and you take it right the first time or not at all.",
    genres: ["Racing", "Indie"],
    price: 480_000,
    state: "PUBLISHED",
    cover: "/covers/neon-drift.svg",
    discountBps: 2500,
    developer: DEVELOPER_ID,
  },
  {
    title: "Hollow Signal",
    description:
      "An abandoned station in Saturn orbit. The signal you keep hearing might be your own voice, ten years from now.",
    genres: ["Adventure", "Mystery"],
    price: 720_000,
    state: "PUBLISHED",
    cover: "/covers/hollow-signal.svg",
    developer: "dev-hollow",
  },
  {
    title: "Paper Kingdoms",
    description:
      "Turn-based strategy on a map drawn across folded paper. Every crease is a border, and folding is a move.",
    genres: ["Strategy", "Turn-based"],
    price: 350_000,
    state: "PUBLISHED",
    cover: "/covers/paper-kingdoms.svg",
    developer: "dev-paper",
  },
  {
    title: "Iron Bloom",
    description:
      "A garden watered with iron. Build it, defend it, and find out what grows when everything is a machine.",
    genres: ["Builder", "Survival"],
    price: 900_000,
    state: "PUBLISHED",
    cover: "/covers/iron-bloom.svg",
    discountBps: 4000,
    developer: "dev-iron",
  },
  {
    title: "Lantern Way",
    description:
      "A long walk with a lantern. A game about arriving somewhere, not about winning.",
    genres: ["Adventure", "Calm"],
    price: 0,
    state: "PUBLISHED",
    cover: "/covers/lantern-way.svg",
    developer: "dev-lantern",
  },
  {
    title: "Vault of Echoes",
    description:
      "A dungeon that remembers one more of its rooms every time you die in it.",
    genres: ["Roguelike", "Action"],
    price: 620_000,
    state: "PUBLISHED",
    cover: "/covers/vault-of-echoes.svg",
    developer: "dev-vault",
  },
  {
    title: "Starforge Tactics",
    description:
      "You build a fleet that makes its own decisions. All you write is the doctrine it fights by.",
    genres: ["Strategy", "Sci-fi"],
    price: 1_100_000,
    state: "PREORDER",
    releaseInDays: 24,
    cover: "/covers/starforge-tactics.svg",
    developer: "dev-starforge",
  },
  {
    title: "Tide & Tally",
    description:
      "A small port and a very large ledger. Bookkeeping turns out to be less forgiving than war.",
    genres: ["Management", "Indie"],
    price: 410_000,
    state: "PREORDER",
    releaseInDays: 9,
    cover: "/covers/tide-and-tally.svg",
    developer: "dev-tide",
  },

  // --- the demo developer's own catalogue, mid-workflow ---------------------
  {
    title: "Glasshouse",
    description:
      "Everything in this city is transparent, including the parts you would rather nobody saw.",
    genres: ["Adventure"],
    price: 0,
    state: "DRAFT",
    cover: "/covers/hollow-signal.svg",
    developer: DEVELOPER_ID,
  },
  {
    title: "Salt & Signal",
    description:
      "A lighthouse keeper, a radio, and a coastline that keeps changing shape.",
    genres: ["Mystery", "Calm"],
    price: 0,
    state: "SUBMITTED",
    cover: "/covers/lantern-way.svg",
    developer: DEVELOPER_ID,
  },
  {
    title: "Cindergrove",
    description:
      "A forest that grows back overnight, and never quite the same way twice.",
    genres: ["Survival", "Builder"],
    price: 0,
    state: "IN_REVIEW",
    cover: "/covers/iron-bloom.svg",
    developer: DEVELOPER_ID,
  },
  {
    title: "Ninefold",
    description:
      "Nine endings, and the game decides which one you have earned.",
    genres: ["Roguelike"],
    price: 0,
    state: "APPROVED",
    suggestedPrice: 550_000,
    cover: "/covers/vault-of-echoes.svg",
    developer: DEVELOPER_ID,
  },
]

export interface RoleRequestSeed {
  request_id: string
  user_id: string
  display_name: string
  email: string
  requested_role: Role
  status: string
  created_at_minutes_ago: number
}

export const SEED_ROLE_REQUESTS: RoleRequestSeed[] = [
  {
    request_id: "req-0001",
    user_id: PLAYER_ID,
    display_name: "Sam Player",
    email: "player@arcadia.local",
    requested_role: "DEVELOPER",
    status: "PENDING",
    created_at_minutes_ago: 60 * 20,
  },
]

export const OPENING_BALANCE = 3_500_000

// --- marketplace (requirement 1.6) ------------------------------------------

export interface MarketItemSeed {
  /** Resolved against `SEED_GAMES[].title` once the games are built, so this
   *  file does not need to know the generated game ids. */
  gameTitle: string
  title: string
  description: string
  imageUrl: string
  buyValue: number
  sellValue: number
}

export const SEED_MARKET_ITEMS: MarketItemSeed[] = [
  {
    gameTitle: "Neon Drift",
    title: "Chrome Spoiler",
    description:
      "A rear wing that does nothing for handling and everything for how the replay looks.",
    imageUrl: "/covers/neon-drift.svg",
    buyValue: 12_000,
    sellValue: 9_500,
  },
  {
    gameTitle: "Vault of Echoes",
    title: "Echo Key",
    description:
      "Opens one door the dungeon does not remember locking. Consumed on use.",
    imageUrl: "/covers/vault-of-echoes.svg",
    buyValue: 8_000,
    sellValue: 6_200,
  },
  {
    gameTitle: "Iron Bloom",
    title: "Rust Seed",
    description: "Plant it and one machine in the garden grows a second arm.",
    imageUrl: "/covers/iron-bloom.svg",
    buyValue: 25_000,
    sellValue: 21_000,
  },
]

// --- community (requirement 1.8) --------------------------------------------

export interface PostSeed {
  gameTitle: string
  authorId: string
  body: string
  tags: string[]
  spoiler?: boolean
  /** emoji → how many seeded reactions, spread across the seed accounts. */
  reactions?: Record<string, number>
  comments?: { authorId: string; body: string }[]
}

export const SEED_POSTS: PostSeed[] = [
  {
    gameTitle: "Neon Drift",
    authorId: DEVELOPER_ID,
    body: "Patch notes for 1.1: the hairpin on Sector 4 no longer eats your brakes. Also fixed the ghost car occasionally driving better than you.",
    tags: ["patch-notes"],
    reactions: { "🔥": 4, "👍": 2 },
    comments: [
      {
        authorId: PLAYER_ID,
        body: "Finally. That hairpin cost me the tournament.",
      },
    ],
  },
  {
    gameTitle: "Neon Drift",
    authorId: PLAYER_ID,
    body: "PB on the coastal loop tonight — 1:04.2. Anyone beating that without the chrome spoiler is lying.",
    tags: ["speedrun"],
    reactions: { "👍": 3, "😮": 1 },
  },
  {
    gameTitle: "Vault of Echoes",
    authorId: PLAYER_ID,
    body: "Spoiler: the room the dungeon adds after your third death is not random. It is always the one you skipped.",
    tags: ["theory"],
    spoiler: true,
    reactions: { "🤔": 5, "🎮": 2 },
    comments: [
      { authorId: SUPPORT_ID, body: "Please tag this — done, thank you." },
    ],
  },
]

// --- festivals (requirement 1.9) --------------------------------------------

export interface FestivalSeed {
  name: string
  description: string
  state: "DRAFT" | "ACTIVE"
  startInDays: number
  endInDays: number
  gameTitles: string[]
  /** Only meaningful for the ACTIVE seed — a live, already-approved discount
   *  on the first game in `gameTitles`, so the storefront has something to show. */
  discountBpsOnFirstGame?: number
}

export const SEED_FESTIVALS: FestivalSeed[] = [
  {
    name: "Midwinter Sale",
    description:
      "A week of platform-wide discounts to close out the season.",
    state: "ACTIVE",
    startInDays: -2,
    endInDays: 5,
    gameTitles: ["Neon Drift", "Iron Bloom"],
    discountBpsOnFirstGame: 3000,
  },
  {
    name: "Indie Spotlight",
    description: "A showcase for the smaller teams on the platform.",
    state: "DRAFT",
    startInDays: 14,
    endInDays: 21,
    gameTitles: ["Paper Kingdoms"],
  },
]
