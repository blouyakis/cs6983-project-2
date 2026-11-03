// Sends the browser to login after an expired session, back to this page
// afterwards. The login page shows the expired message for ?expired=1, like
// proxy.ts does for a page request.
export function goToLogin(): void {
  const next = `${window.location.pathname}${window.location.search}`;
  const params = new URLSearchParams({ next, expired: "1" });
  // A full page load on purpose: Next keeps signed-in pages mounted after
  // client navigation, and an expired session should drop them all. This runs
  // outside React, so useRouter() isn't available either.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/login?${params}`);
}
