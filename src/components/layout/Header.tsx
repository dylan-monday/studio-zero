import { Link } from 'react-router-dom';
import { Container } from '../ui/Container';

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-border">
      <Container>
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="text-xl font-semibold text-text-primary">
            Studio Zero SF
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              to="/"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Home
            </Link>
            <Link
              to="/house-rules"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              House Rules
            </Link>
            <Link
              to="/book"
              className="text-sm font-medium text-white bg-accent hover:bg-accent-hover px-4 py-2 rounded-lg transition-colors"
            >
              Book Now
            </Link>
          </nav>
        </div>
      </Container>
    </header>
  );
}
