"use client"

import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"

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

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold">Create an account</h1>
        <p className="text-sm text-muted-foreground">
          You can sign in as soon as the account exists.
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
