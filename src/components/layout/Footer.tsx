import { Container } from '../ui/Container';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border py-12 mt-auto">
      <Container>
        <div className="flex flex-col md:flex-row justify-between items-start gap-8">
          <div>
            <p className="font-serif text-lg text-text-primary mb-1">Studio Zero</p>
            <p className="text-sm text-text-secondary">San Francisco, CA</p>
          </div>
          <div className="flex items-center gap-8">
            <a
              href="/house-rules"
              className="text-xs font-mono uppercase tracking-widest text-text-secondary hover:text-text-primary transition-colors"
            >
              House Rules
            </a>
            <a
              href="mailto:hello@studiozerosf.com"
              className="text-xs font-mono uppercase tracking-widest text-text-secondary hover:text-text-primary transition-colors"
            >
              Contact
            </a>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-border">
          <p className="text-xs text-text-secondary">
            &copy; {currentYear} Studio Zero SF
          </p>
        </div>
      </Container>
    </footer>
  );
}
