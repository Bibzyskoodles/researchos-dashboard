// Front-end feature flags.
//
// CallScore (remote phone interviews) is temporarily switched off while its
// backend service is not yet mapped to the production domain. With this flag
// off, the "Call" and "Hybrid" collection modes are hidden from project
// creation and the project-page mode toggle, so no new project can enter a
// mode whose engine isn't reachable. Existing code is untouched — flip the
// flag back on to restore it.
//
// To re-enable: set REACT_APP_ENABLE_CALLSCORE=true in the Vercel project
// (and point REACT_APP_CALLSCORE_API_URL at the CallScore backend), then
// redeploy — Create React App inlines env vars at build time.
export const CALLSCORE_ENABLED = process.env.REACT_APP_ENABLE_CALLSCORE === 'true';
