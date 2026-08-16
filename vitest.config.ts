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
      thresholds: {
        "api/**": { statements: 85, branches: 75, functions: 80, lines: 85 },
        "hooks/**": { statements: 90, branches: 85, functions: 90, lines: 90 },
        "lib/**": { statements: 97, branches: 93, functions: 96, lines: 97 },
        "queries/**": { statements: 70, branches: 60, functions: 65, lines: 70 },
        "schemas/**": { statements: 95, branches: 88, functions: 90, lines: 95 },
        "services/http.ts": {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90,
        },
        "services/mocks/**": {
          statements: 45,
          branches: 40,
          functions: 40,
          lines: 45,
        },
        "stores/**": { statements: 95, branches: 90, functions: 95, lines: 95 },
      },
    },
  },
})
