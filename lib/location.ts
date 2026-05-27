import type { EventItem, VenueItem } from "@/lib/types";

export type UserLocation = {
  latitude: number;
  longitude: number;
};

export function distanceMiles(from: UserLocation, to: UserLocation) {
  const earthMiles = 3958.8;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(miles?: number) {
  if (typeof miles !== "number" || !Number.isFinite(miles)) return undefined;
  if (miles < 0.25) return "around the corner";
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

export function enrichDistances(events: EventItem[], venues: VenueItem[], userLocation?: UserLocation) {
  if (!userLocation) return { events, venues };
  const venueDistances = new Map(
    venues.map((venue) => [
      venue.id,
      venue.latitude && venue.longitude
        ? distanceMiles(userLocation, { latitude: venue.latitude, longitude: venue.longitude })
        : undefined
    ])
  );

  const eventsWithDistance = events.map((event) => {
    const distance = venueDistances.get(event.venueId);
    if (typeof distance !== "number") return event;
    const nearbyScore = Math.max(0, 100 - distance * 8);
    return {
      ...event,
      distanceMiles: distance,
      scores: {
        ...event.scores,
        nearby: nearbyScore,
        smart: Math.min(100, event.scores.smart + nearbyScore * 0.08)
      }
    };
  });

  const venuesWithDistance = venues.map((venue) => {
    const distance = venueDistances.get(venue.id);
    return typeof distance === "number" ? { ...venue, distanceMiles: distance } : venue;
  });

  return { events: eventsWithDistance, venues: venuesWithDistance };
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
