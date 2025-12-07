import { makeRequest } from "./map";
import { ENV } from "./env";

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
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  if (!address || address.trim() === "") {
    return null;
  }

  if (ENV.isUiDevMode) {
    return {
      latitude: "37.7749",
      longitude: "-122.4194",
      formattedAddress: address,
    };
  }

  try {
    const response = await makeRequest<{
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
    console.error(`[Geocoding] Error geocoding address: ${address}`, error);
    return null;
  }
}
