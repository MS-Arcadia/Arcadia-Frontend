"use client"

import { IS_MOCKED } from "@/services/http"
import { SEED_USERS } from "@/services/mocks/seed"

interface Props {
  onPick: (email: string, password: string) => void
}

/**
 * One-click sign-in for each role, on the sign-in form.
 *
 * Only rendered while the app is running against the mock — with a real auth
 * service behind it there are no known passwords to offer, so the whole block
 * disappears rather than showing credentials that do not work.
 *
 * It exists because the interesting parts of this app are role-gated. Without it,
 * seeing the review queue means knowing that `support@arcadia.local` exists and
 * what its password is, which is knowledge that lives in a fixture file.
 */
export function DemoAccounts({ onPick }: Props) {
  if (!IS_MOCKED) return null

  const signable = SEED_USERS.filter((user) => user.state === "ACTIVE")

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
      <p className="text-xs text-muted-foreground">
        Running against the mock backend. Pick a role to fill the form:
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {signable.map((user) => (
          <button
            key={user.user_id}
            type="button"
            onClick={() => onPick(user.email, user.password)}
            className="min-h-9 rounded-md border border-border px-2 text-start text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
          >
            {user.role
              .toLowerCase()
              .replace(/_/g, " ")
              .replace(/^\w/, (character) => character.toUpperCase())}
          </button>
        ))}
      </div>
    </div>
  )
}
