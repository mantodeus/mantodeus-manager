import { makeRequest } from "./map";

export interface GeocodeResult {
  latitude: string;
  longitude: string;
  formattedAddress: string;
}

/**
 * Geocode an address using Google Maps Geocoding API via Manus proxy
 * @param address The address to geocode
 * @returns Coordinates and formatted address, or null if geocoding fails
 */
export async function geocodeAddress(address: string, timeoutMs: number = 5000): Promise<GeocodeResult | null> {
  if (!address || address.trim() === "") {
    return null;
  }

  try {
    // Wrap in Promise.race to ensure we don't hang forever
    const geocodePromise = makeRequest<{
      results: Array<{
        formatted_address: string;
        geometry: {
          location: {
            lat: number;
            lng: number;
          };
        };
      }>;
      status: string;
    }>(`/maps/api/geocode/json`, {
      address: address,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Geocoding timeout after ${timeoutMs}ms`)), timeoutMs);
    });

    const response = await Promise.race([geocodePromise, timeoutPromise]);

    if (response.status === "OK" && response.results && response.results.length > 0) {
      const result = response.results[0];
      return {
        latitude: result.geometry.location.lat.toString(),
        longitude: result.geometry.location.lng.toString(),
        formattedAddress: result.formatted_address,
      };
    }

    console.warn(`[Geocoding] Failed to geocode address: ${address}, status: ${response.status}`);
    return null;
  } catch (error) {
    // Don't log timeout errors as errors - they're expected if the service is slow
    if (error instanceof Error && error.message.includes('timeout')) {
      console.warn(`[Geocoding] Timeout geocoding address: ${address}`);
    } else {
      console.error(`[Geocoding] Error geocoding address: ${address}`, error);
    }
    return null;
  }
}
