"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ExternalLink, MapPin, Ticket, Users, X } from "lucide-react";
import type { ReactNode } from "react";
import { SafeImage } from "@/components/safe-image";
import { formatDistance } from "@/lib/location";
import { dayLabel, formatEventTime } from "@/lib/time";
import type { EventItem } from "@/lib/types";
import type { UnifiedPlace } from "@/lib/unified";

const fallbackImage = "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1600&auto=format&fit=crop";

export function EventDetailDrawer({
  event,
  nearbyPlaces = [],
  onClose,
  onOpenPlace
}: {
  event?: EventItem | null;
  nearbyPlaces?: UnifiedPlace[];
  onClose: () => void;
  onOpenPlace?: (place: UnifiedPlace) => void;
}) {
  return (
    <AnimatePresence>
      {event ? (
        <motion.div
          className="fixed inset-0 z-[80] bg-black/46 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.aside
            className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-[2rem] border border-white/28 bg-[linear-gradient(145deg,rgba(9,35,24,0.94),rgba(12,68,45,0.82)_48%,rgba(255,255,255,0.18))] text-bone shadow-[0_24px_90px_rgba(0,0,0,0.46),inset_0_1px_0_rgba(255,255,255,0.38)] ring-1 ring-white/10 backdrop-blur-2xl md:inset-y-0 md:left-auto md:right-0 md:h-full md:max-h-none md:w-[520px] md:rounded-l-[2rem] md:rounded-tr-none"
            initial={{ y: "100%", x: 0, scale: 0.96, filter: "blur(8px)" }}
            animate={{ y: 0, x: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ y: "100%", x: 0, scale: 0.96, filter: "blur(8px)" }}
            transition={{ duration: 0.34, ease: "easeOut" }}
            onClick={(click) => click.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/18 bg-emerald-950/64 px-4 py-3 backdrop-blur-2xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-100">Good pick</p>
              <button className="grid h-10 w-10 place-items-center rounded-full bg-white/24 text-bone shadow-[inset_0_1px_0_rgba(255,255,255,0.32)] transition hover:bg-white/70 hover:text-ink" onClick={onClose} aria-label="Close details">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4">
              <div className="relative min-h-[260px] overflow-hidden rounded-[1.5rem]">
                <SafeImage className="object-cover" src={event.imageUrl} fallbackSrc={fallbackImage} alt="" fill sizes="(max-width: 768px) 100vw, 520px" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/84 via-black/32 to-black/0" />
                <div className="media-copy absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
                  {event.vibeTags.map((tag) => (
                    <span className="rounded-full bg-white/82 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.52)] backdrop-blur-xl" key={tag}>{tag}</span>
                  ))}
                </div>
              </div>

              <h2 className="mt-5 text-3xl font-black leading-tight tracking-[-0.03em] md:text-4xl">{event.title}</h2>
              {event.byline ? <p className="mt-2 text-sm font-semibold text-emerald-100">{event.byline}</p> : null}

              <div className="mt-5 grid gap-3">
                <InfoRow icon={<CalendarDays className="h-4 w-4" />} label="When" value={`${dayLabel(event)} · ${formatEventTime(event)}`} />
                <InfoRow icon={<MapPin className="h-4 w-4" />} label="Where" value={`${event.venueName} · ${event.area === "Burbs" ? "Suburbs" : event.area}${formatDistance(event.distanceMiles) ? ` · ${formatDistance(event.distanceMiles)}` : ""}`} />
                <InfoRow icon={<Ticket className="h-4 w-4" />} label="Cost" value={event.isFree ? "Free" : "Ticketed or RSVP"} />
                <InfoRow icon={<Users className="h-4 w-4" />} label="Signal" value={`${event.category}${event.recurrenceLabel ? ` · ${event.recurrenceLabel}` : ""}`} />
              </div>

              <div className="mt-5 rounded-[1.25rem] border border-white/28 bg-white/18 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.34)] backdrop-blur-xl">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100">Why I’d send this</p>
                <p className="mt-2 text-sm leading-6 text-bone/70">
                  {event.neighborhoodPersonality}. {event.vibeTags.join(", ")} energy, with enough signal to make it feel worth leaving the house.
                </p>
              </div>

              {nearbyPlaces.length ? (
                <div className="mt-5 rounded-[1.25rem] border border-white/28 bg-white/18 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.34)] backdrop-blur-xl">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100">Make it an outing</p>
                  <div className="mt-3 grid gap-2">
                    {nearbyPlaces.map((place) => (
                      <button
                        className="flex items-center justify-between gap-3 rounded-2xl bg-white/14 px-3 py-3 text-left transition hover:bg-white/24"
                        key={place.id}
                        onClick={() => onOpenPlace?.(place)}
                      >
                        <span>
                          <span className="block text-sm font-black text-bone">{place.name}</span>
                          <span className="mt-1 block text-xs font-bold text-bone/54">{place.price ? `${place.price} · ` : ""}{place.vibe}</span>
                        </span>
                        <span className="rounded-full bg-neon/20 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100">Food</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 grid gap-2 text-sm text-bone/68">
                <p><span className="font-black text-bone">Source:</span> {event.source}</p>
                <p><span className="font-black text-bone">Attendee signal:</span> {event.attendeeCount || "Low-key"} · Tastemakers {event.tastemakerCount || 0}</p>
                {event.isRecurring ? <p><span className="font-black text-bone">Recurring:</span> {event.recurrenceLabel || "Yes"}</p> : null}
              </div>

              <div className="mt-6 flex flex-wrap gap-3 pb-4">
                {event.ticketUrl ? (
                  <a className="inline-flex items-center gap-2 rounded-full bg-neon px-4 py-3 text-sm font-black text-emerald-950 shadow-[0_8px_24px_rgba(48,209,88,0.28)] transition hover:bg-[#35E56B]" href={event.ticketUrl} target="_blank" rel="noreferrer">
                    Tickets <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
                {event.eventUrl ? (
                  <a className="inline-flex items-center gap-2 rounded-full border border-white/28 bg-white/18 px-4 py-3 text-sm font-black text-bone transition hover:bg-white/28" href={event.eventUrl} target="_blank" rel="noreferrer">
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
    <div className="flex items-center gap-3 rounded-[1rem] border border-white/24 bg-white/16 px-3 py-3 backdrop-blur-xl">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-neon text-white shadow-[0_8px_24px_rgba(48,209,88,0.24)]">{icon}</div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-bone/42">{label}</p>
        <p className="text-sm font-bold text-bone">{value}</p>
      </div>
    </div>
  );
}
