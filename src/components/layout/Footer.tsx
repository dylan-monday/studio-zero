import { Container } from '../ui/Container';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-surface border-t border-border py-8 mt-auto">
      <Container>
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-text-secondary">
            &copy; {currentYear} Studio Zero SF. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a
              href="/house-rules"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              House Rules
            </a>
            <a
              href="/faq"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              FAQ
            </a>
            <a
              href="mailto:hello@studiozerosf.com"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Contact
            </a>
          </div>
        </div>
      </Container>
    </footer>
  );
}
