"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarDays, ExternalLink, Heart, MapPin, Navigation, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EventDetailDrawer } from "@/components/event-detail-drawer";
import { SafeImage } from "@/components/safe-image";
import { formatDistance } from "@/lib/location";
import { publicPath } from "@/lib/public-path";
import { dayLabel, formatEventTime, isUpcoming, sortSoonest } from "@/lib/time";
import type { EvergreenEventItem, EventItem, VenueItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const fallbackImage = "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1600&auto=format&fit=crop";

export function VenueRoutePage({ venueId }: { venueId: string }) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [venues, setVenues] = useState<VenueItem[]>([]);
  const [evergreenEvents, setEvergreenEvents] = useState<EvergreenEventItem[]>([]);
  const [ready, setReady] = useState(false);
  const [savedVenues, setSavedVenues] = useState<string[]>([]);
  const [detailEvent, setDetailEvent] = useState<EventItem | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("savedVenues");
      if (stored) setSavedVenues(JSON.parse(stored));
    } catch {
      setSavedVenues([]);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(publicPath("/data/events.json")).then((response) => response.json() as Promise<EventItem[]>),
      fetch(publicPath("/data/venues.json")).then((response) => response.json() as Promise<VenueItem[]>),
      fetch(publicPath("/data/evergreen-events.json")).then((response) => response.json() as Promise<EvergreenEventItem[]>).catch(() => [])
    ])
      .then(([nextEvents, nextVenues, nextEvergreenEvents]) => {
        if (!active) return;
        setEvents(nextEvents);
        setVenues(nextVenues);
        setEvergreenEvents(nextEvergreenEvents);
        setReady(true);
      })
      .catch(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const decodedVenueId = decodeURIComponent(venueId);
  const venue = venues.find((item) => item.id === decodedVenueId);
  const venueEvents = useMemo(
    () => events.filter((event) => event.venueId === decodedVenueId && isUpcoming(event)).sort(sortSoonest),
    [decodedVenueId, events]
  );
  const venueEvergreenEvents = useMemo(
    () => evergreenEvents.filter((event) => event.venueId === decodedVenueId),
    [decodedVenueId, evergreenEvents]
  );
  const saved = venue ? savedVenues.includes(venue.id) : false;

  function toggleSavedVenue() {
    if (!venue) return;
    const next = saved ? savedVenues.filter((id) => id !== venue.id) : [...savedVenues, venue.id];
    setSavedVenues(next);
    window.localStorage.setItem("savedVenues", JSON.stringify(next));
  }

  if (!ready) {
    return (
      <main className="min-h-screen px-4 py-6 text-bone">
        <div className="glass-panel mx-auto grid min-h-[80vh] max-w-5xl place-items-center rounded-[2rem] p-5 text-center">
          <div className="w-full max-w-3xl space-y-4">
            <div className="soft-shimmer mx-auto h-14 w-14 rounded-full bg-white/10" />
            <div className="soft-shimmer mx-auto h-10 w-72 max-w-full rounded-full bg-white/10" />
            <div className="soft-shimmer h-72 rounded-[1.5rem] bg-white/8" />
          </div>
        </div>
      </main>
    );
  }

  if (!venue) {
    return (
      <main className="min-h-screen px-4 py-6 text-bone">
        <div className="glass-panel mx-auto grid min-h-[80vh] max-w-5xl place-items-center rounded-[2rem] p-8 text-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-100">Cactus Club</p>
            <h1 className="mt-4 font-display text-5xl leading-none">Venue not found.</h1>
            <Link className="liquid-control mt-6 inline-flex rounded-full px-4 py-2 text-xs font-black text-bone" href="/places">
              Back to places
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-16 text-bone">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="space-y-8"
        >
          <section className="relative min-h-[440px] overflow-hidden rounded-[2rem] border border-white/24 bg-white/12 shadow-card">
            <SafeImage className="object-cover opacity-72" src={venue.imageUrl} fallbackSrc={fallbackImage} alt="" fill priority sizes="100vw" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,12,20,0.88)_0%,rgba(8,12,20,0.68)_48%,rgba(8,12,20,0.24)_100%),linear-gradient(180deg,rgba(8,12,20,0.04),rgba(8,12,20,0.82))]" />
            <div className="relative flex min-h-[440px] flex-col justify-between p-5 md:p-8">
              <div className="flex items-center justify-between gap-3">
                <Link className="liquid-control rounded-full px-4 py-2 text-xs font-black text-bone" href="/places">
                  Back to places
                </Link>
                <button className={cn("grid h-11 w-11 place-items-center rounded-full backdrop-blur-xl transition", saved ? "bg-neon text-white shadow-[0_8px_24px_rgba(48,209,88,0.28)]" : "liquid-control text-bone")} onClick={toggleSavedVenue} aria-label={saved ? "Unsave venue" : "Save venue"}>
                  <Heart className={cn("h-5 w-5", saved && "fill-current")} />
                </button>
              </div>
              <div className="max-w-4xl">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-100">{venue.neighborhoodPersonality}</p>
                <h1 className="mt-3 font-display text-5xl font-black leading-[0.94] text-balance md:text-7xl">{venue.name}</h1>
                <p className="mt-4 max-w-2xl text-lg font-medium leading-8 text-bone/72">
                  {venue.vibe}. {formatDistance(venue.distanceMiles) ? `${formatDistance(venue.distanceMiles)} away. ` : ""}{venueEvents.length || venueEvergreenEvents.length} {venueEvents.length ? "upcoming" : "anytime"} {venueEvents.length === 1 || venueEvergreenEvents.length === 1 ? "move" : "moves"} here.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <span className="liquid-control inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold"><MapPin className="h-4 w-4" />{venue.area === "Burbs" ? "Suburbs" : venue.area}</span>
                  <span className="liquid-control rounded-full px-3 py-2 text-xs font-bold">{venue.upcomingCount} upcoming</span>
                  {(venue.evergreenCount ?? 0) > 0 ? <span className="liquid-control rounded-full px-3 py-2 text-xs font-bold">{venue.evergreenCount} anytime ideas</span> : null}
                  <a className="inline-flex items-center gap-2 rounded-full bg-white/82 px-3 py-2 text-xs font-black text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.52)] transition hover:bg-white" href={venue.mapUrl} target="_blank" rel="noreferrer">
                    Open map <Navigation className="h-4 w-4" />
                  </a>
                  {venue.venueUrl ? (
                    <a className="inline-flex items-center gap-2 rounded-full bg-neon px-3 py-2 text-xs font-black text-white shadow-[0_8px_24px_rgba(48,209,88,0.28)] transition hover:bg-[#35E56B]" href={venue.venueUrl} target="_blank" rel="noreferrer">
                      Venue site <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          {venueEvergreenEvents.length ? (
            <section>
              <div className="mb-4">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-100">Always good here</p>
                <h2 className="mt-2 font-display text-4xl leading-none md:text-5xl">No ticket required.</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {venueEvergreenEvents.map((event) => (
                  <article className="glass-panel rounded-[1.5rem] p-5" key={event.id}>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100">{event.category}</p>
                    <h3 className="mt-3 text-2xl font-black leading-tight">{event.title}</h3>
                    {event.vibeTags.length ? (
                      <div className="mt-5 flex flex-wrap gap-2">
                        {event.vibeTags.slice(0, 4).map((tag) => (
                          <span className="rounded-full bg-white/18 px-3 py-1 text-[11px] font-bold text-bone/76" key={tag}>
                            {tag.replaceAll("-", " ")}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <div className="mb-4">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-100">Happening here</p>
              <h2 className="mt-2 font-display text-4xl leading-none md:text-5xl">Pick the night, not the directory.</h2>
            </div>
            {venueEvents.length ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {venueEvents.map((event) => (
                  <VenueEventCard event={event} key={event.id} onOpenDetails={setDetailEvent} />
                ))}
              </div>
            ) : (
              <div className="glass-panel rounded-[1.5rem] p-8 text-center">
                <p className="text-xl font-black">Nothing upcoming here right now. Keep it saved and check back.</p>
              </div>
            )}
          </section>
        </motion.section>
      </div>
      <EventDetailDrawer event={detailEvent} onClose={() => setDetailEvent(null)} />
    </main>
  );
}

function VenueEventCard({ event, onOpenDetails }: { event: EventItem; onOpenDetails: (event: EventItem) => void }) {
  return (
    <motion.article className="glass-panel group relative rounded-[1.5rem] p-4" whileHover={{ y: -3 }} whileTap={{ scale: 0.99 }} transition={{ duration: 0.22 }}>
      <button className="absolute inset-0 z-10 cursor-pointer rounded-[1.5rem] text-left" onClick={() => onOpenDetails(event)} aria-label={`Open details for ${event.title}`} />
      <div className="relative min-h-48 overflow-hidden rounded-[1rem]">
        <SafeImage className="object-cover" src={event.imageUrl} fallbackSrc={fallbackImage} alt="" fill sizes="(max-width: 768px) 90vw, 360px" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/5" />
        <p className="absolute bottom-3 left-3 rounded-full bg-neon px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white shadow-[0_8px_24px_rgba(48,209,88,0.28)]">{formatEventTime(event)}</p>
      </div>
      <h3 className="mt-4 text-left text-2xl font-black leading-tight transition group-hover:text-emerald-100">{event.title}</h3>
      <p className="mt-2 text-sm text-bone/58"><CalendarDays className="mr-1 inline h-4 w-4" />{dayLabel(event)} · {formatEventTime(event)}</p>
    </motion.article>
  );
}
