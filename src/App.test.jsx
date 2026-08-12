import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

// The app boots to the unified door (C/DL-3b Phase 5, CD-4) and the door is
// white-labeled, so its logo carries the CONTRACTOR's name as alt text. With no
// session, no URL hint and no stored hint, the D4 chain correctly resolves to
// source 5 — neutral RoofMiles — which is what an unknown first-time visitor to
// app.roofmiles.com sees. Asserting that is a smoke test AND a check that the
// chain's fallback still answers.
//
// Was `getByAltText(/rooster booster/i)`: the old screen hardcoded the platform
// wordmark asset regardless of contractor.
test('renders the unified login door, neutrally branded with no hint present', async () => {
  render(<App />);
  await waitFor(() => expect(screen.getByAltText('RoofMiles')).toBeInTheDocument());
  expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
});
