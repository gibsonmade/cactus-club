"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ExternalLink, MapPin, Ticket, Users, X } from "lucide-react";
import type { ReactNode } from "react";
import { SafeImage } from "@/components/safe-image";
import { formatDistance } from "@/lib/location";
import { dayLabel, formatEventTime } from "@/lib/time";
import type { EventItem } from "@/lib/types";

const fallbackImage = "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1600&auto=format&fit=crop";

export function EventDetailDrawer({ event, onClose }: { event?: EventItem | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {event ? (
        <motion.div
          className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.aside
            className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-[2rem] border border-white/12 bg-[#100d0b]/94 text-bone shadow-[0_24px_90px_rgba(0,0,0,0.52)] backdrop-blur-2xl md:inset-y-0 md:left-auto md:right-0 md:h-full md:max-h-none md:w-[520px] md:rounded-l-[2rem] md:rounded-tr-none"
            initial={{ y: "100%", x: 0 }}
            animate={{ y: 0, x: 0 }}
            exit={{ y: "100%", x: 0 }}
            transition={{ duration: 0.34, ease: "easeOut" }}
            onClick={(click) => click.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#100d0b]/78 px-4 py-3 backdrop-blur-2xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-neon">Good pick</p>
              <button className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-bone transition hover:bg-white/16" onClick={onClose} aria-label="Close details">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4">
              <div className="relative min-h-[260px] overflow-hidden rounded-[1.5rem]">
                <SafeImage className="object-cover" src={event.imageUrl} fallbackSrc={fallbackImage} alt="" fill sizes="(max-width: 768px) 100vw, 520px" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/20 to-black/0" />
                <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
                  {event.vibeTags.map((tag) => (
                    <span className="rounded-full bg-bone/90 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-ink" key={tag}>{tag}</span>
                  ))}
                </div>
              </div>

              <h2 className="mt-5 text-3xl font-black leading-tight tracking-[-0.03em] md:text-4xl">{event.title}</h2>
              {event.byline ? <p className="mt-2 text-sm font-semibold text-neon">{event.byline}</p> : null}

              <div className="mt-5 grid gap-3">
                <InfoRow icon={<CalendarDays className="h-4 w-4" />} label="When" value={`${dayLabel(event)} · ${formatEventTime(event)}`} />
                <InfoRow icon={<MapPin className="h-4 w-4" />} label="Where" value={`${event.venueName} · ${event.area === "Burbs" ? "Suburbs" : event.area}${formatDistance(event.distanceMiles) ? ` · ${formatDistance(event.distanceMiles)}` : ""}`} />
                <InfoRow icon={<Ticket className="h-4 w-4" />} label="Cost" value={event.isFree ? "Free" : "Ticketed or RSVP"} />
                <InfoRow icon={<Users className="h-4 w-4" />} label="Signal" value={`${event.category}${event.recurrenceLabel ? ` · ${event.recurrenceLabel}` : ""}`} />
              </div>

              <div className="mt-5 rounded-[1.25rem] border border-white/10 bg-white/7 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-mezcal">Why I’d send this</p>
                <p className="mt-2 text-sm leading-6 text-bone/70">
                  {event.neighborhoodPersonality}. {event.vibeTags.join(", ")} energy, with enough signal to make it feel worth leaving the house.
                </p>
              </div>

              <div className="mt-5 grid gap-2 text-sm text-bone/68">
                <p><span className="font-black text-bone">Source:</span> {event.source}</p>
                <p><span className="font-black text-bone">Attendee signal:</span> {event.attendeeCount || "Low-key"} · Tastemakers {event.tastemakerCount || 0}</p>
                {event.isRecurring ? <p><span className="font-black text-bone">Recurring:</span> {event.recurrenceLabel || "Yes"}</p> : null}
              </div>

              <div className="mt-6 flex flex-wrap gap-3 pb-4">
                {event.ticketUrl ? (
                  <a className="inline-flex items-center gap-2 rounded-full bg-bone px-4 py-3 text-sm font-black text-ink transition hover:bg-neon" href={event.ticketUrl} target="_blank" rel="noreferrer">
                    Tickets <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
                {event.eventUrl ? (
                  <a className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-3 text-sm font-black text-bone transition hover:bg-white/14" href={event.eventUrl} target="_blank" rel="noreferrer">
                    Original listing <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
              </div>
            </div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[1rem] border border-white/8 bg-white/7 px-3 py-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-bone text-ink">{icon}</div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-bone/42">{label}</p>
        <p className="text-sm font-bold text-bone">{value}</p>
      </div>
    </div>
  );
}
