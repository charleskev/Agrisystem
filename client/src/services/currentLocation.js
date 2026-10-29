export function locationFailureMessage(error) {
  if (error?.code === 1) return "Location permission was denied. Allow location access in your browser settings, then try again to see local weather.";
  if (error?.code === 2) return "Your device could not determine its location. Check that device location services are on, then try again.";
  if (error?.code === 3) return "Getting your location took too long. Move somewhere with a clearer GPS signal and try again.";
  if (error?.code === "UNSUPPORTED") return "This browser does not provide GPS location. Open the app over HTTPS or on localhost and try again.";
  if (error?.code === "INSECURE_CONTEXT") return "Browser GPS requires a secure connection. Open the app over HTTPS or on localhost, then try again.";
  return "Your current location is unavailable. Check your browser and device location settings, then try again.";
}

export function getCurrentPosition(geolocation = globalThis.navigator?.geolocation) {
  const hostname = globalThis.location?.hostname;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  if (globalThis.isSecureContext === false && !isLocalhost) {
    return Promise.reject(Object.assign(new Error(locationFailureMessage({ code: "INSECURE_CONTEXT" })), { code: "INSECURE_CONTEXT" }));
  }
  if (!geolocation?.getCurrentPosition) {
    return Promise.reject(Object.assign(new Error(locationFailureMessage({ code: "UNSUPPORTED" })), { code: "UNSUPPORTED" }));
  }
  return new Promise((resolve, reject) => geolocation.getCurrentPosition(
    resolve,
    error => reject(Object.assign(new Error(locationFailureMessage(error)), { code: error?.code })),
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
  ));
}

export function coordinatesFromPosition(position) {
  return {
    latitude: Number(position.coords.latitude.toFixed(5)),
    longitude: Number(position.coords.longitude.toFixed(5)),
  };
}

export function currentWeatherQuery(point) {
  return new URLSearchParams({ latitude: String(point.latitude), longitude: String(point.longitude) }).toString();
}
