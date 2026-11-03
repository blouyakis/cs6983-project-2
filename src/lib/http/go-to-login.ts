// Sends the browser to login after an expired session, back to this page
// afterwards. The login page shows the expired message for ?expired=1, like
// proxy.ts does for a page request.
export function goToLogin(): void {
  const next = `${window.location.pathname}${window.location.search}`;
  const params = new URLSearchParams({ next, expired: "1" });
  window.location.assign(`/login?${params}`);
}
