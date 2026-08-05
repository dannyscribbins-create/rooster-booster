import { render, screen } from '@testing-library/react';
import App from './App';

test('renders app login screen', () => {
  render(<App />);
  const logo = screen.getByAltText(/rooster booster/i);
  expect(logo).toBeInTheDocument();
});
