import * as React from "react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"
import { YOU, currentBid, formatMoney, withPremium } from "./auction"
import { LOTS } from "./catalogue"
import { Footer } from "./home"
import { LotCard, LotImage, StatusTag } from "./lots"
import { useShell } from "./shell"
import { standing, useAuction } from "./store"
import { Countdown, EASE, Eyebrow, btn, useNow } from "./ui"

export function AccountPage({ tab: initial = "bids" }: { tab?: "bids" | "watch" }) {
  const shell = useShell()
  const account = useAuction((s) => s.account)
  const lots = useAuction((s) => s.lots)
  const watch = useAuction((s) => s.watch)
  const signOut = useAuction((s) => s.signOut)
  const now = useNow()
  const [tab, setTab] = React.useState(initial)
  React.useEffect(() => setTab(initial), [initial])

  const mine = LOTS.filter((l) => lots[l.id]?.bids.some((b) => b.bidder === YOU))
  const leading = mine.filter((l) => standing(lots[l.id], now) === "leading")
  const won = mine.filter((l) => standing(lots[l.id], now) === "won")
  const exposure = leading.reduce((sum, l) => sum + currentBid(lots[l.id]), 0)
  const watched = LOTS.filter((l) => watch.includes(l.id))

  if (!account) {
    return (
      <div className="bg-eb-paper text-eb-ink">
        <div data-eb-tone="light" className="mx-auto grid min-h-[70cqh] max-w-xl place-items-center px-6 pb-24 pt-32 text-center">
          <div>
            <Eyebrow className="text-eb-gold-deep">Your paddle</Eyebrow>
            <h1 className="mt-4 font-eb-serif text-5xl">
              Sign in to <em>follow your bids</em>
            </h1>
            <p className="mt-4 font-eb-sans text-sm text-eb-taupe">Your bids, maximums and won lots, all in one place.</p>
            <div className="mt-8 flex justify-center gap-3">
              <button type="button" className={cn(btn.base, btn.solidDark)} onClick={() => shell.requireAccount(undefined, "in")}>
                Sign in
              </button>
              <button type="button" className={cn(btn.base, btn.ghostDark)} onClick={() => shell.requireAccount(undefined, "up")}>
                Register
              </button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="bg-eb-paper text-eb-ink">
      <div data-eb-tone="light" className="mx-auto max-w-[1400px] px-5 pb-24 pt-28 @3xl:px-12">
        <div className="flex flex-col gap-6 @3xl:flex-row @3xl:items-end @3xl:justify-between">
          <div>
            <Eyebrow className="text-eb-gold-deep">Your paddle</Eyebrow>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: EASE }}
              className="mt-4 font-eb-serif text-[clamp(2.4rem,6cqw,4.4rem)] leading-[0.95]"
            >
              Good to see you, <em>{account.name.split(" ")[0]}</em>
            </motion.h1>
            <p className="mt-3 font-eb-sans text-sm text-eb-taupe">{account.email}</p>
          </div>
          <button type="button" onClick={signOut} className={cn(btn.base, btn.ghostDark, "self-start @3xl:self-auto")}>
            Sign out
          </button>
        </div>

        <dl className="mt-12 grid grid-cols-2 gap-px bg-eb-ink/10 @3xl:grid-cols-4">
          {[
            ["Lots bid on", String(mine.length)],
            ["Leading", String(leading.length)],
            ["Won", String(won.length)],
            ["Committed", formatMoney(exposure)],
          ].map(([k, v]) => (
            <div key={k} className="bg-eb-paper p-5 @3xl:p-7">
              <dt className="font-eb-sans text-[0.62rem] uppercase tracking-[0.26em] text-eb-stone">{k}</dt>
              <dd className="mt-2 font-eb-serif text-3xl">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-14 flex gap-6 border-b border-eb-ink/10" role="tablist">
          {(
            [
              ["bids", `My bids (${mine.length})`],
              ["watch", `Watchlist (${watched.length})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn("relative pb-3 font-eb-sans text-[0.68rem] uppercase tracking-[0.24em]", tab === id ? "text-eb-ink" : "text-eb-stone hover:text-eb-ink")}
            >
              {label}
              {tab === id && <motion.span layoutId="eb-acct-tab" className="absolute inset-x-0 -bottom-px h-px bg-eb-ink" />}
            </button>
          ))}
        </div>

        {tab === "bids" ? (
          mine.length === 0 ? (
            <Empty text="You haven't bid yet. The sale is open." />
          ) : (
            <ul className="mt-6 divide-y divide-eb-ink/10">
              {mine.map((lot) => {
                const s = lots[lot.id]
                const st = standing(s, now)
                return (
                  <li key={lot.id}>
                    <button
                      type="button"
                      onClick={() => shell.go({ name: "lot", id: lot.id })}
                      className="group grid w-full grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-5 py-5 text-left @3xl:grid-cols-[5rem_minmax(0,1.6fr)_1fr_1fr_1fr]"
                    >
                      <LotImage lot={lot} width={200} className="aspect-[4/5]" />
                      <div className="min-w-0">
                        <p className="font-eb-sans text-[0.6rem] uppercase tracking-[0.24em] text-eb-taupe">
                          Lot {lot.number} · {lot.maker}
                        </p>
                        <p className="mt-1 truncate font-eb-serif text-xl group-hover:text-eb-gold-deep">{lot.title}</p>
                        <StatusTag state={s} now={now} className="mt-2" />
                      </div>
                      <Figure label="Current bid" value={formatMoney(currentBid(s))} />
                      <Figure label={st === "leading" && s.yourMax ? "Your maximum" : "If you win"} value={formatMoney(st === "leading" && s.yourMax ? s.yourMax : withPremium(currentBid(s)))} />
                      <div className="col-span-2 @3xl:col-span-1">
                        <p className="font-eb-sans text-[0.6rem] uppercase tracking-[0.24em] text-eb-stone">Closes</p>
                        <p className="mt-1 font-eb-sans text-sm">
                          <Countdown endsAt={s.endsAt} />
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )
        ) : watched.length === 0 ? (
          <Empty text="Tap the heart on any lot to watch it here." />
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-12 @md:grid-cols-2 @4xl:grid-cols-4">
            {watched.map((l, i) => (
              <LotCard key={l.id} lot={l} index={i} />
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="hidden @3xl:block">
      <p className="font-eb-sans text-[0.6rem] uppercase tracking-[0.24em] text-eb-stone">{label}</p>
      <p className="mt-1 font-eb-serif text-xl tabular-nums">{value}</p>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  const shell = useShell()
  return (
    <div className="py-20 text-center">
      <p className="font-eb-serif text-2xl italic text-eb-taupe">{text}</p>
      <button type="button" onClick={() => shell.go({ name: "lots" })} className={cn(btn.base, btn.solidDark, "mt-6")}>
        Browse the sale
      </button>
    </div>
  )
}
