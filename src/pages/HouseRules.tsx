import { Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Container } from '../components/ui/Container';
import { Button } from '../components/ui/Button';

const RULES_SECTIONS = [
  {
    title: 'Check-in & Check-out',
    items: [
      'Check-in: 3:00 PM',
      'Check-out: 11:00 AM',
      'Minimum 2-night stay',
    ],
  },
  {
    title: 'Guests',
    items: [
      'Maximum 2 guests',
      'The studio is only to be used by the approved guests — no guests of guests allowed',
      'Perfect for couples or solo travelers',
    ],
  },
  {
    title: 'The Building',
    items: [
      'This is a residential building with great tenants — please be respectful that this is their home',
      'Always lock both the studio and the building doors when you leave',
      'Use the back garden as you like, but please introduce yourself so the tenants know you\'re staying in the studio',
    ],
  },
  {
    title: 'Noise',
    items: [
      'Quiet hours: 10 PM – 8 AM',
      'No loud noise at any time — this is a residential building',
      'No parties or events',
    ],
  },
  {
    title: 'Smoking',
    items: [
      'No smoking inside the studio',
    ],
  },
  {
    title: 'Pets',
    items: [
      'No pets allowed',
    ],
  },
  {
    title: 'Keys & Access',
    items: [
      'Access details will be sent 24 hours before check-in',
      '$150 replacement fee for lost keys',
    ],
  },
  {
    title: 'Laundry',
    items: [
      'Washer and dryer available in the back of the building',
      'Please don\'t leave clothes in the machines after cycles are complete',
    ],
  },
  {
    title: 'Trash & Recycling',
    items: [
      'Place trash and recycling in the bins in the back',
    ],
  },
  {
    title: 'The Studio',
    items: [
      'Comfortable queen bed and workspace',
      'Small fridge — no kitchen (think boutique hotel room)',
      'Great shower with toiletries provided',
      'Closet for hanging clothes',
      'High-speed WiFi and smart TV',
    ],
  },
  {
    title: 'Cancellation Policy',
    items: [
      'Free cancellation up to 7 days before check-in for a full refund',
      'Cancellations within 7 days of check-in are non-refundable',
    ],
  },
];

export function HouseRules() {
  return (
    <Layout>
      <section className="py-16 md:py-24">
        <Container size="sm">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary mb-3">
            Please Note
          </p>
          <h1 className="font-serif text-3xl md:text-4xl text-text-primary mb-4 tracking-tight">
            House Rules
          </h1>
          <p className="text-text-secondary leading-relaxed mb-12">
            We want every guest to have a wonderful stay. These guidelines help us maintain a comfortable
            experience for everyone — our guests and our neighbors.
          </p>

          <div className="space-y-10">
            {RULES_SECTIONS.map((section) => (
              <div key={section.title}>
                <h2 className="font-serif text-xl text-text-primary mb-4 tracking-tight">
                  {section.title}
                </h2>
                <ul className="space-y-3">
                  {section.items.map((item) => (
                    <li key={item} className="flex gap-3 text-text-secondary leading-relaxed">
                      <span className="w-1 h-1 bg-text-primary rounded-full flex-shrink-0 mt-2.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-border mt-16 pt-12 text-center">
            <p className="text-text-secondary mb-6">
              Questions about any of these rules? Just ask.
            </p>
            <Link to="/book">
              <Button size="lg">Book Your Stay</Button>
            </Link>
          </div>
        </Container>
      </section>
    </Layout>
  );
}
