import { VenueRoutePage } from "@/components/venue-route-page";
import venues from "@/public/data/venues.json";

export default function VenuePage({ params }: { params: { venueId: string } }) {
  return <VenueRoutePage venueId={params.venueId} />;
}

export function generateStaticParams() {
  return venues.map((venue) => ({ venueId: venue.id }));
}
