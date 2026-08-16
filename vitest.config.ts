import { fileURLToPath } from "node:url"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

const root = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": root,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    // Spies restored between tests so a `vi.spyOn(toast, "error")` in one file
    // cannot leak its stub into the next.
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
      // What unit tests are held to. `app/` pages and route wrappers are the
      // E2E pipeline's job (the PR workflow boots the image and asks it
      // questions), and `components/ui/` is vendored shadcn primitives —
      // neither belongs under a unit-coverage bar.
      include: [
        "api/**",
        "components/**",
        "hooks/**",
        "lib/**",
        "queries/**",
        "schemas/**",
        "services/**",
        "stores/**",
      ],
      exclude: [
        "components/ui/**",
        "coverage/**",
        "node_modules/**",
        "tests/**",
      ],
      // The bar is per layer, because the layers are not equally unit-testable:
      // `lib/` is pure functions and should be near-exhaustive, while
      // `services/mocks/db.ts` is a stand-in backend whose untested remainder is
      // route plumbing, not rules. A single global number would force the first
      // down to make the second look acceptable.
      //
      // Where a layer sits below its aspiration, the number is set to what the
      // suite actually achieves (a ratchet: it can only go up) rather than to a
      // target the suite fails — a red main helps nobody. Raising these is
      // always a welcome change; lowering one needs a reason in the PR.
      thresholds: {
        "api/**": { statements: 85, branches: 75, functions: 80, lines: 85 },
        "hooks/**": { statements: 90, branches: 85, functions: 90, lines: 90 },
        "lib/**": { statements: 97, branches: 93, functions: 96, lines: 97 },
        // Thin TanStack wrappers. Their request shapes are pinned line-by-line
        // in tests/unit/api/, and the read hooks run end-to-end against the
        // mock backend in tests/unit/queries/against-the-mock.test.ts — what is
        // left uncovered is mostly mutation wrappers whose value a unit test
        // cannot add beyond what those two already prove.
        "queries/**": {
          statements: 25,
          branches: 20,
          functions: 20,
          lines: 24,
        },
        "schemas/**": {
          statements: 95,
          branches: 88,
          functions: 90,
          lines: 95,
        },
        "services/http.ts": {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90,
        },
        // The mock backend: the rules it enforces are tested directly in
        // tests/unit/services/mock-db.test.ts; the long tail is adapter route
        // dispatch that only a full E2E pass would walk.
        "services/mocks/**": {
          statements: 38,
          branches: 28,
          functions: 40,
          lines: 38,
        },
        // `auth.store.ts`'s gap is its server-render storage stub — unreachable
        // from jsdom, where `window` always exists.
        "stores/**": { statements: 92, branches: 78, functions: 84, lines: 91 },
      },
    },
  },
})
