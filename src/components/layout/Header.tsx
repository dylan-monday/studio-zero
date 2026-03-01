import { Link } from 'react-router-dom';
import { Container } from '../ui/Container';

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <Container>
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="font-serif text-xl text-text-primary tracking-tight">
            Studio Zero
          </Link>
          <nav className="flex items-center gap-8">
            <Link
              to="/"
              className="text-sm font-mono uppercase tracking-widest text-text-secondary hover:text-text-primary transition-colors"
            >
              Home
            </Link>
            <Link
              to="/house-rules"
              className="text-sm font-mono uppercase tracking-widest text-text-secondary hover:text-text-primary transition-colors"
            >
              Rules
            </Link>
            <Link
              to="/book"
              className="text-sm font-medium text-background bg-text-primary hover:bg-accent-hover px-5 py-2 transition-colors"
            >
              Book Now
            </Link>
          </nav>
        </div>
      </Container>
    </header>
  );
}
