# Strava OAuth Redirect

## URL contract

| | value |
|---|---|
| App scheme (registered in `app.config.ts`) | `omnibike` |
| Redirect URI (sent to Strava as `redirect_uri`) | `omnibike://localhost/oauth/callback` |
| Strava dev-console **Authorization Callback Domain** | `localhost` |

Strava validates only the **host** portion of `redirect_uri` against the Authorization Callback Domain. Both must match exactly — if you change one, change the other. The scheme (`omnibike`) is free-form for Strava's purposes; iOS uses it to dispatch the deep link back to this app.

Override for alternate environments: set `STRAVA_CALLBACK_DOMAIN` as an env var at build time (see `app.config.ts`). Only change this if you register a different domain in the Strava dev console.

## Delivery mechanism

The authorize page is opened in an in-app **Safari sheet (`SFSafariViewController`)** via `WebBrowser.openBrowserAsync` from `expo-web-browser`. The `omnibike://` redirect is captured by `Linking.addEventListener('url', ...)` from `react-native`. When the callback deep link arrives, the service closes the sheet with `WebBrowser.dismissBrowser()` and continues with the token exchange.

### Why not `openAuthSessionAsync` / `ASWebAuthenticationSession`

The cleaner-looking `WebBrowser.openAuthSessionAsync` wraps iOS `ASWebAuthenticationSession`, which matches the redirect-URI prefix and auto-closes. We used it originally. It consistently **hangs on `accounts.google.com`** for Strava accounts linked to Google Sign-in: after the user taps **Authorize**, Strava's post-consent redirect chain visits a Google account-verification page that does not complete inside `ASWebAuthenticationSession`'s browser context.

`SFSafariViewController` (the full in-app Safari surface) presents as standard Safari to Google's OAuth flow, so the redirect chain completes and we reach the `omnibike://…` deep link. The cost is that we must capture the deep link ourselves via `Linking` and dismiss the browser sheet manually — see `src/services/strava/stravaAuthService.ts` (`awaitRedirectCode`).

### Why not `expo-auth-session`

`expo-auth-session`'s `AuthRequest.promptAsync` is just a wrapper around `openAuthSessionAsync` and inherits the same hang.

### Why not a backend OAuth proxy

Tracked as a separate initiative under `plan.md` → Future Considerations. Not required to fix this bug.

## Test hooks

`src/services/strava/__tests__/stravaAuthService.test.ts` mocks `WebBrowser.openBrowserAsync`, `WebBrowser.dismissBrowser`, and spies on `Linking.addEventListener` so tests fire synthetic `{ url }` events to simulate the iOS deep-link dispatch. See `fireRedirect()` and `deferredBrowserResult()` in that file for the pattern.
