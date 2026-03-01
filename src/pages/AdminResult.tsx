import { useSearchParams, Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Container } from '../components/ui/Container';
import { Button } from '../components/ui/Button';

export function AdminResult() {
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') as 'success' | 'error' | 'info' | null;
  const message = searchParams.get('message');

  const iconConfig = {
    success: {
      bgColor: 'bg-success/10',
      iconColor: 'text-success',
      path: 'M5 13l4 4L19 7',
    },
    error: {
      bgColor: 'bg-error/10',
      iconColor: 'text-error',
      path: 'M6 18L18 6M6 6l12 12',
    },
    info: {
      bgColor: 'bg-text-primary/10',
      iconColor: 'text-text-primary',
      path: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    },
  };

  const config = type ? iconConfig[type] : iconConfig.info;

  return (
    <Layout>
      <div className="py-16 md:py-24">
        <Container size="sm">
          <div className="text-center">
            {/* Icon */}
            <div className={`mx-auto w-16 h-16 ${config.bgColor} rounded-full flex items-center justify-center mb-8`}>
              <svg
                className={`w-8 h-8 ${config.iconColor}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={config.path}
                />
              </svg>
            </div>

            <h1 className="font-serif text-2xl md:text-3xl text-text-primary mb-4 tracking-tight">
              {type === 'success' ? 'Done!' : type === 'error' ? 'Something went wrong' : 'Notice'}
            </h1>

            {message && (
              <p className="text-lg text-text-secondary mb-8 max-w-md mx-auto leading-relaxed">
                {message}
              </p>
            )}

            <Link to="/">
              <Button variant="outline">Back to Home</Button>
            </Link>
          </div>
        </Container>
      </div>
    </Layout>
  );
}
