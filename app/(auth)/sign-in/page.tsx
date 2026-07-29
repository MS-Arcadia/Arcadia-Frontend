"use client"

import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useLoginMutation } from "@/queries/auth"
import { toApiError } from "@/services/http"
import { signInSchema, type SignInForm } from "@/schemas/auth.schema"
import { DemoAccounts } from "@/components/auth/demo-accounts"

export default function SignInPage() {
  const signIn = useLoginMutation()
  const form = useForm<SignInForm>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  })

  // The two refusals worth explaining in place rather than in a toast that
  // disappears: an account that is waiting for approval, and one that was
  // suspended. Both are states of the account, not mistakes in the form.
  const failure = signIn.error ? toApiError(signIn.error) : null
  const accountState =
    failure &&
    ["ACCOUNT_PENDING", "ACCOUNT_REJECTED", "ACCOUNT_BANNED"].includes(
      failure.reason
    )
      ? failure
      : null

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Your library, your wallet and everything you have been told about.
        </p>
      </div>

      <form
        noValidate
        onSubmit={form.handleSubmit((values) =>
          signIn.mutate({ email: values.email, password: values.password })
        )}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(form.formState.errors.email)}
            className="min-h-11"
            {...form.register("email")}
          />
          {form.formState.errors.email && (
            <p className="text-xs text-destructive">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(form.formState.errors.password)}
            className="min-h-11"
            {...form.register("password")}
          />
          {form.formState.errors.password && (
            <p className="text-xs text-destructive">
              {form.formState.errors.password.message}
            </p>
          )}
        </div>

        {accountState && (
          <div className="rounded-lg border border-warning/25 bg-warning/10 p-3 text-xs leading-relaxed text-warning">
            {accountState.message}
          </div>
        )}

        <Button
          type="submit"
          className="min-h-11 w-full"
          disabled={signIn.isPending}
        >
          {signIn.isPending && <Loader2 className="size-4 animate-spin" />}
          Sign in
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        No account yet?{" "}
        <Link href="/sign-up" className="text-primary hover:underline">
          Create one
        </Link>
      </p>

      <DemoAccounts
        onPick={(email, password) => {
          form.setValue("email", email)
          form.setValue("password", password)
        }}
      />
    </div>
  )
}
