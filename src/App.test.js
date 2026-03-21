import { render, screen } from '@testing-library/react';
import App from './App';

test('renders app login screen', () => {
  render(<App />);
  const heading = screen.getByText(/rooster booster/i);
  expect(heading).toBeInTheDocument();
});
