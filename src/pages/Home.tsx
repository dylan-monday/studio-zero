import { Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Container } from '../components/ui/Container';
import { Button } from '../components/ui/Button';
import { PhotoGallery } from '../components/gallery/PhotoGallery';
import { AvailabilityCalendar } from '../components/booking/AvailabilityCalendar';

const HERO_IMAGE = '/photos/sf-skyline.jpg';

const GALLERY_PHOTOS = [
  { id: 'bed', url: '/photos/bed.jpg', alt_text: 'Comfortable queen bed', is_hero: true },
  { id: 'studio', url: '/photos/studio.jpg', alt_text: 'Studio living space' },
  { id: 'workspace', url: '/photos/workspace.jpg', alt_text: 'Personal workspace' },
  { id: 'bathroom', url: '/photos/bathroom.jpg', alt_text: 'Modern bathroom' },
  { id: 'shower', url: '/photos/shower.jpg', alt_text: 'Walk-in shower' },
];

export function Home() {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative h-[75vh] min-h-[560px]">
        <div className="absolute inset-0">
          <img
            src={HERO_IMAGE}
            alt="San Francisco skyline view from Dolores Park"
            className="w-full h-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/80" />
        </div>
        <Container className="relative h-full flex flex-col justify-end pb-16">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/70 mb-4">
            San Francisco
          </p>
          <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl text-white mb-4 tracking-tight">
            Studio Zero
          </h1>
          <p className="text-lg text-white/80 max-w-md mb-10 leading-relaxed">
            A thoughtfully designed studio in the heart of the city.
            Your home base for exploring San Francisco.
          </p>
          <Link to="/book">
            <Button size="lg" className="w-full sm:w-auto bg-white text-text-primary hover:bg-white/90">
              Check Availability
            </Button>
          </Link>
        </Container>
      </section>

      {/* Quick Info Bar */}
      <section className="border-b border-border py-8">
        <Container>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="font-serif text-3xl text-text-primary">2</p>
              <p className="text-xs font-mono uppercase tracking-widest text-text-secondary mt-1">Guests</p>
            </div>
            <div>
              <p className="font-serif text-3xl text-text-primary">1</p>
              <p className="text-xs font-mono uppercase tracking-widest text-text-secondary mt-1">Studio</p>
            </div>
            <div>
              <p className="font-serif text-3xl text-text-primary">1</p>
              <p className="text-xs font-mono uppercase tracking-widest text-text-secondary mt-1">Bathroom</p>
            </div>
            <div>
              <p className="font-serif text-3xl text-text-primary">2+</p>
              <p className="text-xs font-mono uppercase tracking-widest text-text-secondary mt-1">Night Min</p>
            </div>
          </div>
        </Container>
      </section>

      {/* Photo Gallery */}
      <section className="py-16 md:py-24">
        <Container>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary mb-3">
            Gallery
          </p>
          <h2 className="font-serif text-3xl md:text-4xl text-text-primary mb-10 tracking-tight">
            The Space
          </h2>
          <PhotoGallery staticPhotos={GALLERY_PHOTOS} />
        </Container>
      </section>

      {/* Property Description */}
      <section className="py-16 md:py-24 bg-surface">
        <Container>
          <div className="grid md:grid-cols-2 gap-16">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary mb-3">
                About
              </p>
              <h2 className="font-serif text-3xl md:text-4xl text-text-primary mb-8 tracking-tight">
                Your Stay
              </h2>
              <div className="space-y-5">
                <p className="text-text-secondary leading-relaxed">
                  Welcome to Studio Zero — a clean, comfortable private studio in a
                  residential building in one of San Francisco's best neighborhoods.
                  Think boutique hotel room, not apartment.
                </p>
                <p className="text-text-secondary leading-relaxed">
                  The studio features a comfortable queen bed, a dedicated workspace,
                  a great shower, and a small fridge. No kitchen — but you're in one of
                  the best neighborhoods for coffee and food in the world.
                </p>
                <p className="text-text-secondary leading-relaxed">
                  High-speed WiFi, smart TV with streaming, washer/dryer in the
                  building, and a shared back garden round out the experience.
                </p>
              </div>
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary mb-3">
                Included
              </p>
              <h3 className="font-serif text-2xl text-text-primary mb-6 tracking-tight">
                Amenities
              </h3>
              <ul className="grid grid-cols-2 gap-4">
                {[
                  'High-speed WiFi',
                  'Smart TV',
                  'Small fridge',
                  'Washer/Dryer',
                  'Heating',
                  'Workspace',
                  'Great shower',
                  'Closet',
                  'Back garden',
                  'Toiletries',
                ].map((amenity) => (
                  <li key={amenity} className="flex items-center gap-3 text-text-secondary">
                    <span className="w-1 h-1 bg-text-primary rounded-full flex-shrink-0" />
                    {amenity}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </section>

      {/* House Rules Summary */}
      <section className="py-16 md:py-24">
        <Container>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary mb-3">
            Please Note
          </p>
          <h2 className="font-serif text-3xl md:text-4xl text-text-primary mb-10 tracking-tight">
            House Rules
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'Check-in: 3:00 PM', subtitle: 'Check-out: 11:00 AM' },
              { title: 'Maximum 2 guests', subtitle: 'No guests of guests' },
              { title: 'No smoking', subtitle: 'Inside the studio' },
              { title: 'No pets', subtitle: 'No exceptions' },
              { title: 'Residential building', subtitle: 'Be respectful of neighbors' },
              { title: 'Lock up', subtitle: '$150 fee for lost keys' },
            ].map((rule) => (
              <div key={rule.title} className="p-5 border border-border">
                <p className="font-medium text-text-primary mb-1">{rule.title}</p>
                <p className="text-sm text-text-secondary">{rule.subtitle}</p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Link to="/house-rules" className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary hover:text-text-primary transition-colors">
              View all house rules &rarr;
            </Link>
          </div>
        </Container>
      </section>

      {/* Neighborhood */}
      <section className="py-16 md:py-24 bg-surface">
        <Container>
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary mb-3">
                Location
              </p>
              <h2 className="font-serif text-3xl md:text-4xl text-text-primary mb-6 tracking-tight">
                The Neighborhood
              </h2>
              <p className="text-text-secondary leading-relaxed mb-6">
                Located in a vibrant San Francisco neighborhood with easy access to
                public transit, restaurants, and local attractions. Walk to nearby
                parks, cafes, and shops within minutes.
              </p>
              <ul className="space-y-3">
                {[
                  '5 min walk to MUNI/BART',
                  'Restaurants and cafes nearby',
                  'Grocery stores within walking distance',
                  'Close to popular attractions',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-text-secondary">
                    <span className="w-1 h-1 bg-text-primary rounded-full flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="overflow-hidden aspect-[4/3]">
              <img
                src="/photos/neighborhood.png"
                alt="San Francisco neighborhood"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </Container>
      </section>

      {/* Availability Calendar */}
      <section className="py-16 md:py-24">
        <Container>
          <div className="max-w-xl mx-auto">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-secondary mb-3 text-center">
              Availability
            </p>
            <h2 className="font-serif text-3xl md:text-4xl text-text-primary mb-2 text-center tracking-tight">
              Plan Your Stay
            </h2>
            <p className="text-text-secondary text-center mb-10">
              Select your dates to see pricing
            </p>
            <AvailabilityCalendar />
            <div className="mt-10 text-center">
              <Link to="/book">
                <Button size="lg" className="w-full sm:w-auto">
                  Book Your Stay
                </Button>
              </Link>
            </div>
          </div>
        </Container>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32 bg-text-primary text-white">
        <Container className="text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/50 mb-4">
            Direct Booking
          </p>
          <h2 className="font-serif text-4xl md:text-5xl mb-6 tracking-tight">
            Ready to visit?
          </h2>
          <p className="text-white/70 text-lg mb-10 max-w-md mx-auto leading-relaxed">
            Experience San Francisco like a local. Book directly for the best rates.
          </p>
          <Link to="/book">
            <Button size="lg" className="bg-white text-text-primary hover:bg-white/90">
              Check Availability
            </Button>
          </Link>
        </Container>
      </section>
    </Layout>
  );
}
