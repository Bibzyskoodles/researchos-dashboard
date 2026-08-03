import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

// This file was Create React App's scaffold ("renders learn react link"),
// asserting on text that has never existed in this application. It failed from
// the day the project was created and nobody saw it, because CI only ran the
// build and never the tests.
//
// A smoke test on App is worth having: it mounts the router and every
// top-level provider (auth, Ada, gamify), so it catches the class of mistake
// that takes the whole app down at once — a bad provider nesting, a context
// that throws on first render, a broken route table. None of that shows up in
// a type-check.

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the sign-in screen when nobody is authenticated', () => {
    render(<App />);

    // Unauthenticated visitors are redirected to /login. Asserting on what the
    // user actually sees, rather than on the route, keeps this meaningful if
    // the path ever changes.
    expect(screen.getByText(/sign in to your workspace/i)).toBeInTheDocument();
  });

  it('mounts without a stored session and without throwing', () => {
    // The providers run on mount and read localStorage. An empty store is the
    // first-visit case and must not be an error path.
    expect(() => render(<App />)).not.toThrow();
  });
});
