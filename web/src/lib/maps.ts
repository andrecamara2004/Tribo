// src/lib/maps.ts
// Single source of truth for the Google Maps JS loader. The loader allows only
// ONE config per page — every useJsApiLoader call must pass identical options
// (same id + same libraries array reference), or it throws "Loader must not be
// called again with different options". Both the map and the Places autocomplete
// go through this hook.
import { useJsApiLoader } from "@react-google-maps/api";

export const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

// Module-level (stable reference): passing a fresh array each render makes the
// loader reload unintentionally.
const MAPS_LIBRARIES: ("places")[] = ["places"];

export function useMapsLoader() {
  return useJsApiLoader({
    id: "tribo-gmaps",
    googleMapsApiKey: MAPS_KEY ?? "",
    libraries: MAPS_LIBRARIES,
  });
}
