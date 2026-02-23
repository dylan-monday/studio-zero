import { Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Container } from '../components/ui/Container';
import { Button } from '../components/ui/Button';
import { PhotoGallery } from '../components/gallery/PhotoGallery';
import { AvailabilityCalendar } from '../components/booking/AvailabilityCalendar';

const HERO_IMAGE = '/photos/bed.jpg';

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
      <section className="relative h-[70vh] min-h-[500px]">
        <div className="absolute inset-0">
          <img
            src={HERO_IMAGE}
            alt="Studio Zero SF interior"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40" />
        </div>
        <Container className="relative h-full flex flex-col justify-end pb-12">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white mb-4">
            Studio Zero SF
          </h1>
          <p className="text-lg md:text-xl text-white/90 max-w-xl mb-8">
            A beautifully designed studio apartment in the heart of San Francisco.
            Your perfect home base for exploring the city.
          </p>
          <Link to="/book">
            <Button size="lg" className="w-full sm:w-auto">
              Check Availability
            </Button>
          </Link>
        </Container>
      </section>

      {/* Quick Info Bar */}
      <section className="bg-surface border-y border-border py-6">
        <Container>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-2xl font-semibold text-text-primary">2</p>
              <p className="text-sm text-text-secondary">Guests</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-text-primary">1</p>
              <p className="text-sm text-text-secondary">Bedroom</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-text-primary">1</p>
              <p className="text-sm text-text-secondary">Bathroom</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-text-primary">2+</p>
              <p className="text-sm text-text-secondary">Night Minimum</p>
            </div>
          </div>
        </Container>
      </section>

      {/* Photo Gallery */}
      <section className="py-12 md:py-16">
        <Container>
          <h2 className="text-2xl md:text-3xl font-semibold text-text-primary mb-8">
            The Space
          </h2>
          <PhotoGallery staticPhotos={GALLERY_PHOTOS} />
        </Container>
      </section>

      {/* Property Description */}
      <section className="py-12 md:py-16 bg-surface">
        <Container>
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-2xl md:text-3xl font-semibold text-text-primary mb-6">
                About This Place
              </h2>
              <div className="prose prose-gray max-w-none">
                <p className="text-text-secondary leading-relaxed mb-4">
                  Welcome to Studio Zero SF, a thoughtfully designed studio apartment
                  that combines modern comfort with San Francisco charm. Whether you're
                  visiting for business or pleasure, this space offers everything you
                  need for a memorable stay.
                </p>
                <p className="text-text-secondary leading-relaxed mb-4">
                  The studio features a comfortable queen bed, a fully equipped kitchen,
                  a dedicated workspace, and a cozy living area. Natural light fills
                  the space throughout the day, creating an inviting atmosphere.
                </p>
                <p className="text-text-secondary leading-relaxed">
                  Enjoy modern amenities including high-speed WiFi, smart TV with
                  streaming services, in-unit washer/dryer, and climate control for
                  your comfort.
                </p>
              </div>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-text-primary mb-4">
                Amenities
              </h3>
              <ul className="grid grid-cols-2 gap-3">
                {[
                  'High-speed WiFi',
                  'Smart TV',
                  'Full kitchen',
                  'Washer/Dryer',
                  'Air conditioning',
                  'Heating',
                  'Workspace',
                  'Coffee maker',
                  'Hair dryer',
                  'Iron',
                ].map((amenity) => (
                  <li key={amenity} className="flex items-center gap-2 text-text-secondary">
                    <svg className="w-5 h-5 text-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {amenity}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </section>

      {/* House Rules Summary */}
      <section className="py-12 md:py-16">
        <Container>
          <h2 className="text-2xl md:text-3xl font-semibold text-text-primary mb-8">
            House Rules
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: '🕐', title: 'Check-in: 3:00 PM', subtitle: 'Check-out: 11:00 AM' },
              { icon: '👥', title: 'Maximum 2 guests', subtitle: 'Perfect for couples or solo travelers' },
              { icon: '🚭', title: 'No smoking', subtitle: 'Inside or on balcony' },
              { icon: '🐾', title: 'No pets', subtitle: 'Sorry, allergies!' },
              { icon: '🎉', title: 'No parties', subtitle: 'Respect the neighbors' },
              { icon: '🔇', title: 'Quiet hours', subtitle: '10 PM - 8 AM' },
            ].map((rule) => (
              <div key={rule.title} className="flex items-start gap-4 p-4 bg-surface rounded-xl">
                <span className="text-2xl">{rule.icon}</span>
                <div>
                  <p className="font-medium text-text-primary">{rule.title}</p>
                  <p className="text-sm text-text-secondary">{rule.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link to="/house-rules" className="text-accent hover:text-accent-hover font-medium">
              View all house rules →
            </Link>
          </div>
        </Container>
      </section>

      {/* Neighborhood */}
      <section className="py-12 md:py-16 bg-surface">
        <Container>
          <h2 className="text-2xl md:text-3xl font-semibold text-text-primary mb-6">
            The Neighborhood
          </h2>
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <p className="text-text-secondary leading-relaxed mb-4">
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
                  <li key={item} className="flex items-center gap-2 text-text-secondary">
                    <svg className="w-5 h-5 text-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl overflow-hidden aspect-video">
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
      <section className="py-12 md:py-16">
        <Container>
          <div className="max-w-xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-semibold text-text-primary mb-2 text-center">
              Check Availability
            </h2>
            <p className="text-text-secondary text-center mb-8">
              Select your dates to see pricing and book your stay
            </p>
            <AvailabilityCalendar />
            <div className="mt-8 text-center">
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
      <section className="py-16 md:py-24 bg-text-primary text-white">
        <Container className="text-center">
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">
            Ready to book your stay?
          </h2>
          <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
            Experience San Francisco like a local. Book directly for the best rates
            and personalized service.
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
