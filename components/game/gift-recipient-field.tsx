"use client"

import { useId, useState } from "react"
import { Check } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { RecipientSuggestion } from "@/api/auth"

interface Props {
  value: string
  onChange: (value: string) => void
  onPick: (person: RecipientSuggestion) => void
  suggestions: RecipientSuggestion[]
  found: RecipientSuggestion | null
  loading: boolean
  empty: boolean
}

/**
 * Confirm an exact typed email or display name, or a row the sender already picked.
 *
 * A unique prefix is not enough — `player@` matching one account must not send
 * until they pick, or finish the address. Two people called Nadia Farr stay a
 * list, not a guess.
 */
export function resolvedGiftRecipient(
  query: string,
  suggestions: RecipientSuggestion[],
  picked: RecipientSuggestion | null
): RecipientSuggestion | null {
  const wanted = query.trim().toLowerCase()
  if (!wanted) return null
  if (
    picked &&
    (picked.email.toLowerCase() === wanted ||
      picked.display_name.toLowerCase() === wanted)
  ) {
    return picked
  }
  const byEmail = suggestions.filter(
    (row) => row.email.toLowerCase() === wanted
  )
  if (byEmail.length === 1) return byEmail[0]
  const byName = suggestions.filter(
    (row) => row.display_name.toLowerCase() === wanted
  )
  if (byName.length === 1) return byName[0]
  return null
}

/** Keep a previous page of suggestions on screen only if they still match what is typed. */
export function suggestionFitsQuery(
  person: RecipientSuggestion,
  query: string
): boolean {
  const needle = query.trim().toLowerCase()
  if (needle.length < 2) return false
  const email = person.email.toLowerCase()
  const name = person.display_name.toLowerCase()
  return (
    email.startsWith(needle) ||
    name.startsWith(needle) ||
    name.includes(` ${needle}`)
  )
}

export function GiftRecipientField({
  value,
  onChange,
  onPick,
  suggestions,
  found,
  loading,
  empty,
}: Props) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const showList = open && !found && suggestions.length > 0
  const activeIndex = Math.min(active, Math.max(suggestions.length - 1, 0))

  function pick(person: RecipientSuggestion) {
    onPick(person)
    setOpen(false)
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="recipient" className="text-xs">
        Who is it for
      </Label>
      <div className="relative">
        <Input
          id="recipient"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showList
              ? `${listId}-${suggestions[activeIndex]?.user_id}`
              : undefined
          }
          value={value}
          onChange={(event) => {
            onChange(event.target.value)
            setOpen(true)
            setActive(0)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false)
              return
            }
            if (event.key === "ArrowDown" && suggestions.length) {
              event.preventDefault()
              setOpen(true)
              setActive((current) => (current + 1) % suggestions.length)
              return
            }
            if (event.key === "ArrowUp" && suggestions.length) {
              event.preventDefault()
              setOpen(true)
              setActive(
                (current) =>
                  (current - 1 + suggestions.length) % suggestions.length
              )
              return
            }
            if (event.key === "Enter" && showList && suggestions[activeIndex]) {
              event.preventDefault()
              pick(suggestions[activeIndex])
            }
          }}
          placeholder="Their email or name"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby="recipient-state"
          className="min-h-11"
        />
        {showList && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-background py-1 shadow-md"
          >
            {suggestions.map((person, index) => (
              <li key={person.user_id} role="presentation">
                <button
                  type="button"
                  id={`${listId}-${person.user_id}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm",
                    index === activeIndex && "bg-muted"
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(person)}
                >
                  <span className="font-medium">{person.display_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {person.email}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p id="recipient-state" className="min-h-5 text-xs">
        {loading && <span className="text-muted-foreground">Looking…</span>}
        {!loading && found && (
          <span className="inline-flex items-center gap-1.5 font-medium text-brand-sky">
            <Check className="size-3.5" />
            Sending to {found.display_name}
          </span>
        )}
        {!loading && !found && empty && (
          <span className="text-muted-foreground">
            No account matches that. Check the spelling, or ask them for the
            email they signed up with.
          </span>
        )}
      </p>
    </div>
  )
}
