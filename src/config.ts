/**
 * App configuration. Point BASE_URL at your Jolly Bakery API server.
 *
 * The Postman collection ships with `http://jolly.local` (a dev host). On a
 * physical device that name won't resolve — use the server's LAN IP or a
 * public URL, e.g. `http://192.168.1.50` or `https://api.jolly.co.ke`.
 *
 * Note: plain http:// is blocked by default on Android/iOS release builds.
 * For local http testing use a dev build, or put the API behind https.
 */
export const config = {
	// ⬇️  CHANGE THIS to your reachable server.
	baseUrl: 'https://api.jolly.kovacpay.com',

	// Hardcoded per the API docs ("client_id should be hardcoded in your app").
	clientId: 'jolly_mobile_app',

	// Access tokens last 24h; we refresh silently a little early.
	tokenRefreshSkewMs: 60 * 60 * 1000, // refresh if <1h left

	// Set false to silence network/auth console logging in production.
	debug: true,
} as const;

export default config;
