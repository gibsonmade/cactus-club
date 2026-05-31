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
          className="fixed inset-0 z-[80] bg-emerald-950/54 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.aside
            className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-[2rem] border border-white/60 bg-bone text-ink shadow-[0_24px_90px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.72)] ring-1 ring-emerald-950/8 md:inset-y-0 md:left-auto md:right-0 md:h-full md:max-h-none md:w-[560px] md:rounded-l-[2rem] md:rounded-r-none"
            initial={{ y: "100%", x: 0, scale: 0.96, filter: "blur(8px)" }}
            animate={{ y: 0, x: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ y: "100%", x: 0, scale: 0.96, filter: "blur(8px)" }}
            transition={{ duration: 0.34, ease: "easeOut" }}
            onClick={(click) => click.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-emerald-950/10 bg-bone/90 px-4 py-3 backdrop-blur-2xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-cactus">Good pick</p>
              <button className="bevel-button bevel-button-icon rounded-full" onClick={onClose} aria-label="Close details">
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
              {event.byline ? <p className="mt-2 text-sm font-semibold text-ink/62">{event.byline}</p> : null}

              <div className="mt-5 grid gap-3">
                <InfoRow icon={<CalendarDays className="h-4 w-4" />} label="When" value={`${dayLabel(event)} · ${formatEventTime(event)}`} />
                <InfoRow icon={<MapPin className="h-4 w-4" />} label="Where" value={`${event.venueName} · ${event.area === "Burbs" ? "Suburbs" : event.area}${formatDistance(event.distanceMiles) ? ` · ${formatDistance(event.distanceMiles)}` : ""}`} />
                <InfoRow icon={<Ticket className="h-4 w-4" />} label="Cost" value={event.isFree ? "Free" : "Ticketed or RSVP"} />
                <InfoRow icon={<Users className="h-4 w-4" />} label="Signal" value={`${event.category}${event.recurrenceLabel ? ` · ${event.recurrenceLabel}` : ""}`} />
              </div>

              <div className="mt-5 rounded-[1.25rem] border border-emerald-950/10 bg-white/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-xl">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cactus">Why I’d send this</p>
                <p className="mt-2 text-sm leading-6 text-ink/70">
                  {event.neighborhoodPersonality}. {event.vibeTags.join(", ")} energy, with enough signal to make it feel worth leaving the house.
                </p>
              </div>

              {nearbyPlaces.length ? (
                <div className="mt-5 rounded-[1.25rem] border border-emerald-950/10 bg-white/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-xl">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-cactus">Make it an outing</p>
                  <div className="mt-3 grid gap-2">
                    {nearbyPlaces.map((place) => (
                      <button
                        className="bevel-button flex items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left"
                        key={place.id}
                        onClick={() => onOpenPlace?.(place)}
                      >
                        <span>
                          <span className="block text-sm font-black text-ink">{place.name}</span>
                          <span className="mt-1 block text-xs font-bold text-ink/54">{place.price ? `${place.price} · ` : ""}{place.vibe}</span>
                        </span>
                        <span className="rounded-full bg-neon/20 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-cactus">Food</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 grid gap-2 text-sm text-ink/68">
                <p><span className="font-black text-ink">Source:</span> {event.source}</p>
                <p><span className="font-black text-ink">Attendee signal:</span> {event.attendeeCount || "Low-key"} · Tastemakers {event.tastemakerCount || 0}</p>
                {event.isRecurring ? <p><span className="font-black text-ink">Recurring:</span> {event.recurrenceLabel || "Yes"}</p> : null}
              </div>

              <div className="mt-6 flex flex-wrap gap-3 pb-4">
                {event.ticketUrl ? (
                  <a className="bevel-button-primary inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-black" href={event.ticketUrl} target="_blank" rel="noreferrer">
                    Tickets <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
                {event.eventUrl ? (
                  <a className="bevel-button inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-black" href={event.eventUrl} target="_blank" rel="noreferrer">
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
    <div className="flex items-center gap-3 rounded-[1rem] border border-emerald-950/10 bg-white/72 px-3 py-3 backdrop-blur-xl">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-neon text-emerald-950 shadow-[0_8px_24px_rgba(48,209,88,0.24)]">{icon}</div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-ink/42">{label}</p>
        <p className="text-sm font-bold text-ink">{value}</p>
      </div>
    </div>
  );
}
