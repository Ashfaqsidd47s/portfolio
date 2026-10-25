import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { Check, Eye, EyeOff, Gavel } from "lucide-react"
import { cn } from "@/lib/utils"
import { BUYERS_PREMIUM, YOU, formatMoney, leader, nextMinimum, withPremium } from "./auction"
import { getLot, photoUrl } from "./catalogue"
import { useAuction } from "./store"
import { Dialog, EASE, Eyebrow, btn } from "./ui"

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string | null
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="font-eb-sans text-[0.62rem] uppercase tracking-[0.26em] text-eb-taupe">{label}</span>
      {children}
      <AnimatePresence>
        {error && (
          <motion.span
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="block overflow-hidden font-eb-sans text-xs text-eb-red"
          >
            <span className="block pt-1.5">{error}</span>
          </motion.span>
        )}
      </AnimatePresence>
    </label>
  )
}

const input =
  "mt-2 h-11 w-full border-b border-eb-ink/20 bg-transparent font-eb-sans text-[0.95rem] text-eb-ink placeholder:text-eb-stone/70 transition-colors focus:border-eb-ink focus:outline-none"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function AuthDialog({
  open,
  mode: initial,
  onClose,
  onDone,
}: {
  open: boolean
  mode: "in" | "up"
  onClose: () => void
  onDone: () => void
}) {
  const signIn = useAuction((s) => s.signIn)
  const signUp = useAuction((s) => s.signUp)
  const [mode, setMode] = React.useState(initial)
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [show, setShow] = React.useState(false)
  const [terms, setTerms] = React.useState(false)
  const [tried, setTried] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setMode(initial)
    setTried(false)
    setError(null)
    setPassword("")
  }, [open, initial])

  const errors = {
    name: mode === "up" && name.trim().length < 2 ? "Please enter your full name." : null,
    email: !EMAIL.test(email.trim()) ? "Enter a valid email address." : null,
    password: password.length < 8 ? "Use at least 8 characters." : mode === "up" && !/\d/.test(password) ? "Include at least one number." : null,
    terms: mode === "up" && !terms ? "Please accept the conditions of sale." : null,
  }
  const valid = !Object.values(errors).some(Boolean)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    setError(null)
    if (!valid) return
    setBusy(true)
    // A beat, so it feels like a real round-trip.
    window.setTimeout(() => {
      const err = mode === "up" ? signUp(name, email, password) : signIn(email, password)
      setBusy(false)
      if (err) setError(err)
      else onDone()
    }, 650)
  }

  const demo = () => {
    const email = "guest@11bits.demo"
    const password = "rare-things-11"
    const existing = useAuction.getState().accounts.some((a) => a.email === email)
    const err = existing ? signIn(email, password) : signUp("Guest Collector", email, password)
    if (!err) onDone()
  }

  const strength = Math.min(4, [password.length >= 8, /\d/.test(password), /[A-Z]/.test(password), /[^\w]/.test(password) || password.length >= 14].filter(Boolean).length)

  return (
    <Dialog open={open} onClose={onClose} label={mode === "in" ? "Sign in" : "Create an account"} className="max-w-[440px]">
      <div className="px-8 pb-8 pt-10 @lg:px-10">
        <p className="text-center font-eb-serif text-3xl">
          11<em>bits</em>
        </p>
        <div className="mt-6 grid grid-cols-2 border-b border-eb-ink/10" role="tablist">
          {(["in", "up"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m)
                setError(null)
                setTried(false)
              }}
              className={cn("relative pb-3 font-eb-sans text-[0.68rem] uppercase tracking-[0.26em] transition-colors", mode === m ? "text-eb-ink" : "text-eb-stone hover:text-eb-ink")}
            >
              {m === "in" ? "Sign in" : "Register"}
              {mode === m && <motion.span layoutId="eb-auth-tab" className="absolute inset-x-0 -bottom-px h-px bg-eb-ink" transition={{ duration: 0.45, ease: EASE }} />}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.form
            key={mode}
            onSubmit={submit}
            noValidate
            initial={{ opacity: 0, x: mode === "up" ? 24 : -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: mode === "up" ? -24 : 24 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="mt-7 grid gap-5"
          >
            <p className="font-eb-serif text-lg italic leading-snug text-eb-taupe">
              {mode === "in" ? "Welcome back. Your paddle is waiting." : "Register once to bid on every sale, worldwide."}
            </p>
            {mode === "up" && (
              <Field label="Full name" error={tried ? errors.name : null}>
                <input className={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Alexandra Laurent" />
              </Field>
            )}
            <Field label="Email" error={tried ? errors.email : null}>
              <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" />
            </Field>
            <Field label="Password" error={tried ? errors.password : null}>
              <span className="relative block">
                <input
                  className={cn(input, "pr-10")}
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "in" ? "current-password" : "new-password"}
                  placeholder={mode === "up" ? "8+ characters, one number" : "Your password"}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? "Hide password" : "Show password"}
                  className="absolute right-0 top-1/2 mt-1 grid size-9 -translate-y-1/2 place-items-center text-eb-stone hover:text-eb-ink"
                >
                  {show ? <EyeOff className="size-4" strokeWidth={1.5} /> : <Eye className="size-4" strokeWidth={1.5} />}
                </button>
              </span>
              {mode === "up" && password && (
                <span className="mt-2 flex gap-1" aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className={cn("h-0.5 flex-1 transition-colors duration-500", i < strength ? (strength >= 3 ? "bg-eb-green" : "bg-eb-gold") : "bg-eb-ink/10")} />
                  ))}
                </span>
              )}
            </Field>
            {mode === "up" && (
              <Field label="" error={tried ? errors.terms : null}>
                <span className="flex items-start gap-3 font-eb-sans text-xs leading-relaxed text-eb-taupe">
                  <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-eb-ink" />
                  I accept the conditions of sale and confirm I'm over 18. Accounts in this demo stay in this browser.
                </span>
              </Field>
            )}
            <AnimatePresence>
              {error && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-eb-red/10 px-3 py-2.5 font-eb-sans text-xs text-eb-red" role="alert">
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
            <button type="submit" disabled={busy} className={cn(btn.base, btn.solidDark, "mt-1 h-12 w-full disabled:opacity-70")}>
              {busy ? <span className="size-4 animate-spin rounded-full border border-eb-ivory/30 border-t-eb-ivory" /> : mode === "in" ? "Sign in" : "Create account"}
            </button>
            <div className="flex items-center gap-3 font-eb-sans text-[0.6rem] uppercase tracking-[0.24em] text-eb-stone">
              <span className="h-px flex-1 bg-eb-ink/10" /> or <span className="h-px flex-1 bg-eb-ink/10" />
            </div>
            <button type="button" onClick={demo} className={cn(btn.base, btn.ghostDark, "h-11 w-full")}>
              Continue with a demo account
            </button>
          </motion.form>
        </AnimatePresence>
      </div>
    </Dialog>
  )
}

export type BidDraft = { lotId: string; amount: number; max?: number }

/** Review, then the gavel: the last step before a bid reaches the room. */
export function BidDialog({ draft, onClose }: { draft: BidDraft | null; onClose: () => void }) {
  const bid = useAuction((s) => s.bid)
  const [phase, setPhase] = React.useState<"review" | "placing" | "done">("review")
  const [error, setError] = React.useState<string | null>(null)
  const [agree, setAgree] = React.useState(false)
  const [raised, setRaised] = React.useState(false)
  // Kept after close, so the panel doesn't empty while it fades out.
  const [d, setD] = React.useState(draft)
  const lot = d ? getLot(d.lotId) : undefined

  React.useEffect(() => {
    if (!draft) return
    setD(draft)
    setPhase("review")
    setError(null)
    setAgree(false)
  }, [draft])

  const ceiling = d ? Math.max(d.amount, d.max ?? 0) : 0
  const state = useAuction((s) => (d ? s.lots[d.lotId] : undefined))
  // Raising a maximum while already in the lead places no new bid.
  const raising = !!state && leader(state) === YOU && phase === "review"

  const confirm = () => {
    if (!d) return
    setPhase("placing")
    window.setTimeout(() => {
      setRaised(leader(useAuction.getState().lots[d.lotId]) === YOU)
      const r = bid(d.lotId, d.amount, d.max)
      if (r.ok) {
        setPhase("done")
        window.setTimeout(onClose, 1900)
      } else {
        setPhase("review")
        setError(r.error)
      }
    }, 700)
  }

  return (
    <Dialog open={!!draft} onClose={onClose} label="Confirm your bid" className="max-w-[460px]">
      {lot && d && (
        <AnimatePresence mode="wait" initial={false}>
          {phase !== "done" ? (
            <motion.div key="review" exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }} className="p-8 @lg:p-10">
              <Eyebrow className="text-eb-gold-deep">Confirm your bid</Eyebrow>
              <div className="mt-6 flex gap-4">
                <img src={photoUrl(lot.photos[0]?.src ?? "", 160, 200)} alt="" className="h-24 w-[4.8rem] shrink-0 bg-eb-ink-3 object-cover" />
                <div className="min-w-0">
                  <p className="font-eb-sans text-[0.62rem] uppercase tracking-[0.24em] text-eb-taupe">
                    Lot {lot.number} · {lot.maker}
                  </p>
                  <p className="mt-1 font-eb-serif text-2xl leading-tight">{lot.title}</p>
                </div>
              </div>
              <dl className="mt-7 grid gap-3 border-y border-eb-ink/10 py-5 font-eb-sans text-sm">
                <div className="flex justify-between">
                  <dt className="text-eb-taupe">{raising ? "Your new maximum" : "Your bid"}</dt>
                  <dd className="font-eb-serif text-xl tabular-nums">{formatMoney(d.amount)}</dd>
                </div>
                {d.max && d.max > d.amount && (
                  <div className="flex justify-between">
                    <dt className="text-eb-taupe">Maximum, bid for you</dt>
                    <dd className="tabular-nums">{formatMoney(d.max)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-eb-taupe">Buyer's premium ({Math.round(BUYERS_PREMIUM * 100)}%)</dt>
                  <dd className="tabular-nums">{formatMoney(withPremium(ceiling) - ceiling)}</dd>
                </div>
                <div className="flex justify-between border-t border-eb-ink/10 pt-3">
                  <dt>If you win at {d.max && d.max > d.amount ? "your maximum" : "this bid"}</dt>
                  <dd className="font-eb-serif text-xl tabular-nums">{formatMoney(withPremium(ceiling))}</dd>
                </div>
              </dl>
              {state && !raising && nextMinimum(state) > d.amount && (
                <p className="mt-4 bg-eb-gold/15 px-3 py-2.5 font-eb-sans text-xs text-eb-gold-deep" role="status">
                  The room has moved: the next bid is now {formatMoney(nextMinimum(state))}.{" "}
                  <button type="button" className="underline underline-offset-2" onClick={() => setD({ ...d, amount: nextMinimum(state) })}>
                    Bid that instead
                  </button>
                </p>
              )}
              <label className="mt-5 flex cursor-pointer items-start gap-3 font-eb-sans text-xs leading-relaxed text-eb-taupe">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-eb-ink" />
                I understand a bid is a binding offer to buy, and can't be withdrawn. Shipping and taxes are calculated after the sale.
              </label>
              {error && (
                <p className="mt-4 bg-eb-red/10 px-3 py-2.5 font-eb-sans text-xs text-eb-red" role="alert">
                  {error}
                </p>
              )}
              <button type="button" disabled={!agree || phase === "placing"} onClick={confirm} className={cn(btn.base, btn.solidDark, "mt-6 h-14 w-full")}>
                {phase === "placing" ? (
                  <span className="size-4 animate-spin rounded-full border border-eb-ivory/30 border-t-eb-ivory" />
                ) : (
                  <>
                    <Gavel className="size-4" strokeWidth={1.5} /> Confirm bid
                  </>
                )}
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: EASE }}
              className="grid place-items-center px-10 py-16 text-center"
            >
              <motion.span
                initial={{ scale: 0, rotate: -40 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}
                className="grid size-16 place-items-center rounded-full bg-eb-ink text-eb-ivory"
              >
                <Check className="size-7" strokeWidth={1.5} />
              </motion.span>
              <p className="mt-6 font-eb-serif text-3xl">{raised ? "Maximum raised" : "You lead the room"}</p>
              <p className="mt-2 font-eb-sans text-sm text-eb-taupe">
                {raised
                  ? `We'll bid for you on ${lot.title} up to ${formatMoney(ceiling)}.`
                  : `${formatMoney(d.amount)} on ${lot.title}. We'll tell you the moment anyone goes higher.`}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </Dialog>
  )
}
