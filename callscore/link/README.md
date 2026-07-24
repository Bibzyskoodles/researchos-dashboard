# CallScore Link — Device 1 Companion App

Single-purpose companion app (Bible Part 6.1): reports call state for the
phone that places the actual call, while the CallScore app on Device 2
runs the interview. **Requests zero OS permissions in this MVP.**

## MVP transport: cloud relay (Bible 6.2, path 3)

Pairing works by code: Device 2 shows a short Link code during a live
interview; enter it here, then tap **Call started** / **Call ended** at the
trust-critical moments. Timestamps land on the same backend columns the
late-start/early-stop check reads (Bible 6.5), so timing flags work
identically to the future BLE path.

The cloud relay is explicitly the *weakest supported path* — it requires
both devices online. That is an accepted MVP constraint, not the end
state.

## V1: automatic call-state detection + BLE (native work, not yet built)

Per Bible 6.1/6.2, V1 replaces the manual taps and the relay with:
- iOS: `CXCallObserver` (CallKit) — needs a custom native module / Expo
  dev-client build
- Android: `AudioManager.getMode() == MODE_IN_COMMUNICATION` (VoIP-generic)
  + `TelephonyManager` call state (GSM) — same
- BLE pairing to Device 2 (offline-first transport)
- On-device OCR (Vision / ML Kit) for the call-screen screenshot

None of these are possible in managed Expo — they need a dev-client with
native modules. The explicitly rejected approaches in Bible 6.3
(Accessibility-Service capture, ReplayKit, notification listeners, call
interception) stay rejected; do not re-propose them.

## Screenshot handling

The enumerator screenshots the call screen for their own records; this app
never touches the image. Only the number/name they type in are transmitted
(`screenshot_extracted_fields`), matching Bible 6.1's immediate-discard rule.

## Run

```bash
cd callscore/link
npm install
npm run typecheck
npm start   # Expo Go
```
