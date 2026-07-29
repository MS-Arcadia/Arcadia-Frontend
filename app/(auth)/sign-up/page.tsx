"use client"

import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Clock, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRegisterMutation } from "@/queries/auth"
import { signUpSchema, type SignUpForm } from "@/schemas/auth.schema"

export default function SignUpPage() {
  const register = useRegisterMutation()
  const form = useForm<SignUpForm>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: "", email: "", password: "", confirm: "" },
  })

  /**
   * The whole reason this page has two states.
   *
   * Requirement 1.1 puts an administrator's approval between registering and
   * signing in, so the response carries a PENDING user and no token. Redirecting
   * to the store would land somebody on a 401; redirecting to sign-in would let
   * them try a password that is going to be refused. Saying what happens next is
   * the only honest option.
   */
  if (register.isSuccess) {
    return (
      <div className="space-y-4 rounded-xl border border-border bg-card p-6 text-center">
        <span
          aria-hidden
          className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary/15 text-primary"
        >
          <Clock className="size-5" strokeWidth={1.75} />
        </span>
        <h1 className="text-lg font-semibold">
          Account created, waiting for approval
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          An administrator has to approve{" "}
          <span className="text-foreground">{register.data.email}</span> before
          it can sign in. You will be told when that happens.
        </p>
        <Button
          variant="outline"
          className="min-h-11 w-full"
          nativeButton={false}
          render={<Link href="/sign-in" />}
        >
          Back to sign in
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold">Create an account</h1>
        <p className="text-sm text-muted-foreground">
          An administrator approves new accounts before they can sign in.
        </p>
      </div>

      <form
        noValidate
        onSubmit={form.handleSubmit((values) =>
          register.mutate({
            email: values.email,
            password: values.password,
            display_name: values.displayName,
          })
        )}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            autoComplete="name"
            aria-invalid={Boolean(form.formState.errors.displayName)}
            className="min-h-11"
            {...form.register("displayName")}
          />
          {form.formState.errors.displayName && (
            <p className="text-xs text-destructive">
              {form.formState.errors.displayName.message}
            </p>
          )}
        </div>

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
            autoComplete="new-password"
            aria-invalid={Boolean(form.formState.errors.password)}
            className="min-h-11"
            {...form.register("password")}
          />
          {form.formState.errors.password ? (
            <p className="text-xs text-destructive">
              {form.formState.errors.password.message}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              At least 8 characters.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm">Repeat password</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(form.formState.errors.confirm)}
            className="min-h-11"
            {...form.register("confirm")}
          />
          {form.formState.errors.confirm && (
            <p className="text-xs text-destructive">
              {form.formState.errors.confirm.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="min-h-11 w-full"
          disabled={register.isPending}
        >
          {register.isPending && <Loader2 className="size-4 animate-spin" />}
          Create account
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have one?{" "}
        <Link href="/sign-in" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
