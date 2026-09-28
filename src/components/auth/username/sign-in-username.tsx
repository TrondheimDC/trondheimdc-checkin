"use client"

import { authMutationKeys, validateStringLength } from "@better-auth-ui/core"
import { isPasskeyAutoFillEnabled, withPasskeyAutoFill } from "@better-auth-ui/core/plugins/passkey"
import type { UsernameAuthClient } from "@better-auth-ui/core/plugins/username"
import { AuthPrompts, useAuth, useAuthPlugin, useFetchOptions } from "@better-auth-ui/react"
import { useSignInUsername } from "@better-auth-ui/react/plugins/username"
import { useIsMutating } from "@tanstack/react-query"
import { Eye, EyeOff, Lock } from "lucide-react"
import { useState } from "react"
import { ProviderButtons, type SocialLayout } from "@/components/auth/provider-buttons"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { useSignInContinuation } from "@/lib/auth/use-sign-in-continuation"
import { usernamePlugin } from "@/lib/auth/username-plugin"
import { cn } from "@/lib/utils"
import { isAuthFormFieldInvalid, useAuthForm } from "../auth-form"
import { LastUsedBadge } from "../last-login-method/last-used-badge"
import { ReauthenticationNotice } from "../reauthentication"

export type SignInUsernameProps = {
  className?: string
  socialLayout?: SocialLayout
  socialPosition?: "top" | "bottom"
}

/** Username-only admin sign-in (no email path, no public sign-up). */
export function SignInUsername({
  className,
  socialLayout,
  socialPosition = "bottom",
}: SignInUsernameProps) {
  const { authClient, emailAndPassword, localization, plugins, socialProviders } =
    useAuth<UsernameAuthClient>()

  const { fetchOptions, resetFetchOptions } = useFetchOptions()
  const continueSignIn = useSignInContinuation()
  const { localization: usernameLocalization } = useAuthPlugin(usernamePlugin)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)

  const form = useAuthForm({
    defaultValues: { identifier: "", password: "", rememberMe: false },
    onSubmit: async ({ value }) => {
      await signInUsername({
        username: value.identifier,
        password: value.password,
        ...(emailAndPassword?.rememberMe ? { rememberMe: value.rememberMe } : {}),
        fetchOptions,
      })
    },
  })

  const { mutateAsync: signInUsername, isPending: isSignInUsernamePending } = useSignInUsername(
    authClient,
    {
      onError: () => {
        form.setFieldValue("password", "")
        resetFetchOptions()
      },
      onSuccess: (data) => {
        sessionStorage.removeItem("better-auth-ui.verify-email")
        continueSignIn(data)
      },
    },
  )

  const signInMutating = useIsMutating({
    mutationKey: authMutationKeys.signIn.all,
  })
  const signUpMutating = useIsMutating({
    mutationKey: authMutationKeys.signUp.all,
  })
  const isPending = signInMutating + signUpMutating > 0
  const isSignInPending = isSignInUsernamePending

  const Captcha = plugins.find((plugin) => plugin.captchaComponent)?.captchaComponent

  const passkeyAutoFill = isPasskeyAutoFillEnabled(plugins)

  const showSeparator = emailAndPassword?.enabled && socialProviders && socialProviders.length > 0

  return (
    <Card className={cn("w-full max-w-sm gap-5 py-8", className)}>
      <AuthPrompts view="signIn" />
      <ReauthenticationNotice />
      <CardHeader className="justify-items-center gap-3 text-center">
        <div className="mb-1 flex size-11 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-fg-brand)_16%,transparent)] text-[var(--color-fg-brand)]">
          <Lock className="size-5" aria-hidden />
        </div>
        <CardTitle className="text-xl font-semibold">{localization.auth.signIn}</CardTitle>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-6">
          {socialPosition === "top" && (
            <>
              {socialProviders && socialProviders.length > 0 && (
                <ProviderButtons socialLayout={socialLayout} view="signIn" />
              )}

              {showSeparator && (
                <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card m-0 flex items-center text-xs">
                  {localization.auth.or}
                </FieldSeparator>
              )}
            </>
          )}

          {emailAndPassword?.enabled && (
            <form.AppForm>
              <form.AuthFormRoot>
                <FieldGroup>
                  <form.AppField
                    name="identifier"
                    validators={{
                      onSubmit: ({ value }) =>
                        validateStringLength(value, {
                          requiredMessage: localization.auth.fieldRequired,
                          trim: true,
                        }),
                    }}
                  >
                    {(field) => {
                      const isInvalid = isAuthFormFieldInvalid(field.state.meta)
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor="username">
                            {usernameLocalization.username}
                          </FieldLabel>

                          <Input
                            id="username"
                            name={field.name}
                            type="text"
                            autoComplete={withPasskeyAutoFill("username", passkeyAutoFill)}
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            placeholder={usernameLocalization.usernamePlaceholder}
                            required
                            disabled={isPending}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => field.handleChange(event.target.value)}
                            aria-invalid={isInvalid}
                          />
                          <field.AuthFormFieldError />
                        </Field>
                      )
                    }}
                  </form.AppField>

                  <form.AppField
                    name="password"
                    validators={{
                      // Sign-in: required only, on submit. Length rules belong on sign-up.
                      onSubmit: ({ value }) =>
                        validateStringLength(value, {
                          requiredMessage: localization.auth.fieldRequired,
                        }),
                    }}
                  >
                    {(field) => {
                      const isInvalid = isAuthFormFieldInvalid(field.state.meta)
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor="password">{localization.auth.password}</FieldLabel>

                          <InputGroup>
                            <InputGroupInput
                              id="password"
                              name={field.name}
                              type={isPasswordVisible ? "text" : "password"}
                              autoComplete={withPasskeyAutoFill(
                                "current-password",
                                passkeyAutoFill,
                              )}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(event) => field.handleChange(event.target.value)}
                              placeholder={localization.auth.passwordPlaceholder}
                              required
                              disabled={isPending}
                              aria-invalid={isInvalid}
                            />

                            <InputGroupAddon align="inline-end">
                              <InputGroupButton
                                size="icon-xs"
                                aria-label={
                                  isPasswordVisible
                                    ? localization.auth.hidePassword
                                    : localization.auth.showPassword
                                }
                                title={
                                  isPasswordVisible
                                    ? localization.auth.hidePassword
                                    : localization.auth.showPassword
                                }
                                onClick={() => {
                                  setIsPasswordVisible((visible) => !visible)
                                }}
                              >
                                {isPasswordVisible ? <EyeOff /> : <Eye />}
                              </InputGroupButton>
                            </InputGroupAddon>
                          </InputGroup>

                          <field.AuthFormFieldError />
                        </Field>
                      )
                    }}
                  </form.AppField>

                  {emailAndPassword.rememberMe && (
                    <form.AppField name="rememberMe">
                      {(field) => (
                        <Field className="my-1">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              id="rememberMe"
                              name={field.name}
                              checked={field.state.value}
                              disabled={isPending}
                              onCheckedChange={(checked) => field.handleChange(checked === true)}
                            />

                            <FieldLabel
                              htmlFor="rememberMe"
                              className="cursor-pointer text-sm font-normal"
                            >
                              {localization.auth.rememberMe}
                            </FieldLabel>
                          </div>
                        </Field>
                      )}
                    </form.AppField>
                  )}

                  {Captcha && <div className="flex justify-center">{Captcha}</div>}

                  <form.AuthFormServerError />

                  <div className="flex flex-col gap-3">
                    <form.AuthFormSubmitButton
                      isPending={isSignInPending}
                      className="relative overflow-visible"
                      disabled={isPending}
                    >
                      {localization.auth.signIn}

                      <LastUsedBadge method={["username"]} floating />
                    </form.AuthFormSubmitButton>

                    {plugins.flatMap((plugin) =>
                      (plugin.authButtons ?? []).map((AuthButton, index) => (
                        <AuthButton key={`${plugin.id}-${index.toString()}`} view="signIn" />
                      )),
                    )}
                  </div>
                </FieldGroup>
              </form.AuthFormRoot>
            </form.AppForm>
          )}

          {socialPosition === "bottom" && (
            <>
              {showSeparator && (
                <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card flex items-center text-xs">
                  {localization.auth.or}
                </FieldSeparator>
              )}

              {socialProviders && socialProviders.length > 0 && (
                <ProviderButtons socialLayout={socialLayout} view="signIn" />
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
