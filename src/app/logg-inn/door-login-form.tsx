"use client"

import { REGEXP_ONLY_DIGITS } from "input-otp"
import { Keyboard, QrCode } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { LoginQrUnderPrinterIllustration } from "@/components/admin/enroll-illustrations"
import { ScanCamera } from "@/components/scan-camera"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import {
  normalizeStasjonTokenBodyInput,
  parseStasjonTokenInput,
  STASJON_TOKEN_BODY_LENGTH,
  STASJON_TOKEN_PREFIX_LABEL,
  stasjonTokenBody,
} from "@/lib/stasjon-token"
import { apiPath } from "@/lib/utils"

type AcquireMode = "choose" | "manual"

function setTokenInUrl(token: string) {
  const url = new URL(window.location.href)
  url.searchParams.set("token", token)
  window.history.replaceState(null, "", `${url.pathname}${url.search}`)
}

function clearTokenFromUrl() {
  const url = new URL(window.location.href)
  url.searchParams.delete("token")
  window.history.replaceState(null, "", `${url.pathname}${url.search}`)
}

export function DoorLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlToken = searchParams.get("token")?.trim() || ""
  const [token, setToken] = useState(() => parseStasjonTokenInput(urlToken) ?? "")
  const [acquireMode, setAcquireMode] = useState<AcquireMode>("choose")
  const [manualDraft, setManualDraft] = useState("")
  const [scanOpen, setScanOpen] = useState(false)
  const [pin, setPin] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)
  const pinInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setToken(parseStasjonTokenInput(urlToken) ?? "")
  }, [urlToken])

  function acceptToken(next: string) {
    setToken(next)
    setTokenInUrl(next)
    setAcquireMode("choose")
    setManualDraft("")
    setScanOpen(false)
    setError(null)
    setPin("")
  }

  function resetToken() {
    setToken("")
    clearTokenFromUrl()
    setAcquireMode("choose")
    setManualDraft("")
    setPin("")
    setError(null)
  }

  function submitManual(event: React.FormEvent) {
    event.preventDefault()
    const parsed = parseStasjonTokenInput(manualDraft)
    if (!parsed) {
      setError(`Ugyldig kode. Skriv ${STASJON_TOKEN_BODY_LENGTH} tegn, eller lim inn hele lenken.`)
      return
    }
    acceptToken(parsed)
  }

  async function submitPin(nextPin: string) {
    if (!token || nextPin.length !== 6 || pendingRef.current) return
    pendingRef.current = true
    setPending(true)
    setError(null)
    const response = await fetch(apiPath("/api/auth/stasjon/sign-in"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, pin: nextPin }),
    })
    pendingRef.current = false
    setPending(false)
    if (!response.ok) {
      // input-otp is one hidden input — mid-slot edit is awkward on mobile.
      // Clear so staff can retype from the start.
      setError("Ugyldig QR eller PIN")
      setPin("")
      queueMicrotask(() => pinInputRef.current?.focus())
      return
    }
    router.replace(apiPath("/"))
    router.refresh()
  }

  function onSubmitPin(event: React.FormEvent) {
    event.preventDefault()
    void submitPin(pin)
  }

  function onPinChange(value: string) {
    setPin(value)
    setError(null)
    if (value.length === 6) void submitPin(value)
  }

  if (!token) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-col gap-5">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Innsjekkstasjon</h1>
          <p className="text-sm text-[var(--color-fg-base)]/70">
            Skann QR under printeren, eller lim inn kode/lenke fra Slack. Deretter PIN fra Slack.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl bg-[var(--color-bg-surface)] p-3">
          <LoginQrUnderPrinterIllustration />
        </div>

        {acquireMode === "choose" ? (
          <div className="flex flex-col gap-2">
            <Button type="button" size="lg" onClick={() => setScanOpen(true)}>
              <QrCode className="size-5" aria-hidden />
              Skann QR
            </Button>
            <Button type="button" variant="surface" size="lg" onClick={() => setAcquireMode("manual")}>
              <Keyboard className="size-5" aria-hidden />
              Skriv inn kode manuelt
            </Button>
          </div>
        ) : (
          <form onSubmit={submitManual} className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="stasjon-token">Kode</FieldLabel>
              <InputGroup className="h-14 rounded-xl border-0 bg-[var(--color-bg-surface)] shadow-none has-[[data-slot=input-group-control]:focus-visible]:border-transparent has-[[data-slot=input-group-control]:focus-visible]:ring-2 has-[[data-slot=input-group-control]:focus-visible]:ring-[var(--color-fg-brand)]/40">
                <InputGroupAddon align="inline-start">
                  <InputGroupText className="font-mono text-base text-[var(--color-fg-base)]/50">
                    {STASJON_TOKEN_PREFIX_LABEL}
                  </InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id="stasjon-token"
                  value={manualDraft}
                  onChange={(e) => {
                    setManualDraft(normalizeStasjonTokenBodyInput(e.target.value))
                    setError(null)
                  }}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData("text")
                    if (!text.trim()) return
                    e.preventDefault()
                    setManualDraft(normalizeStasjonTokenBodyInput(text))
                    setError(null)
                  }}
                  placeholder="ABCD…"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  autoFocus
                  className="h-14 font-mono text-lg tracking-wide uppercase"
                />
              </InputGroup>
              <FieldDescription>
                Lim inn hele koden eller lenken —{" "}
                <span className="font-mono">{STASJON_TOKEN_PREFIX_LABEL}</span> strippes automatisk.
              </FieldDescription>
            </Field>
            {error ? (
              <FieldError className="text-[var(--color-bg-danger)]">{error}</FieldError>
            ) : null}
            <Button type="submit" size="lg" disabled={manualDraft.length < STASJON_TOKEN_BODY_LENGTH}>
              Fortsett
            </Button>
            <Button
              type="button"
              variant="surface"
              onClick={() => {
                setAcquireMode("choose")
                setError(null)
              }}
            >
              Tilbake
            </Button>
          </form>
        )}

        <Dialog open={scanOpen} onOpenChange={setScanOpen}>
          <DialogContent className="w-[min(100%-1.5rem,28rem)] max-w-none p-4">
            <DialogTitle>Skann innloggings-QR</DialogTitle>
            <DialogDescription>QR-koden står under printeren.</DialogDescription>
            <div className="mt-4">
              {scanOpen ? (
                <ScanCamera
                  mode="qr"
                  parse={parseStasjonTokenInput}
                  onFound={acceptToken}
                  invalidMessage="Det er ikke en stasjons-QR. Skann koden under printeren."
                  cameraError="Ingen tilgang til kamera. Skriv inn koden manuelt i stedet."
                  hint="Skann QR under printeren"
                />
              ) : null}
            </div>
            <DialogClose asChild>
              <Button type="button" variant="surface" size="lg" className="mt-4 w-full">
                Avbryt
              </Button>
            </DialogClose>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmitPin} className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Innsjekkstasjon</h1>
        <p className="text-sm text-[var(--color-fg-base)]/70">
          Angi PIN fra Slack for å logge inn.
        </p>
        <p className="font-mono text-xs opacity-50">
          <span className="opacity-60">{STASJON_TOKEN_PREFIX_LABEL}</span>
          {stasjonTokenBody(token)}
        </p>
      </div>
      <FieldGroup>
        <Field>
          <FieldLabel className="justify-center">PIN</FieldLabel>
          <InputOTP
            ref={pinInputRef}
            maxLength={6}
            pattern={REGEXP_ONLY_DIGITS}
            value={pin}
            onChange={onPinChange}
            containerClassName="justify-center"
            autoFocus
            disabled={pending}
          >
            <InputOTPGroup>
              {Array.from({ length: 6 }, (_, index) => (
                <InputOTPSlot key={index} index={index} className="size-11 text-lg" />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </Field>
        {error ? (
          <FieldError className="text-center text-[var(--color-bg-danger)]">{error}</FieldError>
        ) : null}
        <Button type="submit" size="lg" disabled={pending || pin.length !== 6}>
          {pending ? "Logger inn…" : "Logg inn"}
        </Button>
        <Button type="button" variant="surface" onClick={resetToken}>
          Bytt stasjon / skann på nytt
        </Button>
      </FieldGroup>
    </form>
  )
}
