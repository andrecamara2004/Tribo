// src/lib/geo.ts
// Thin promise wrapper over the browser Geolocation API.

export interface Coords {
  lat: number;
  lng: number;
}

/** Resolve the device's current position, or reject with a friendly message. */
export function getCurrentPosition(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Location isn't supported by this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied."
            : "Couldn't get your location.";
        reject(new Error(msg));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  });
}
