import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      className="d-flex flex-column justify-content-center align-items-center"
      style={{
        minHeight: '100vh',
        background: '#0a1628',
        fontFamily: "'Inter Tight', Arial, sans-serif",
      }}
    >
      <div className="text-center">
        <h1
          className="fw-bold mb-2"
          style={{
            fontSize: '120px',
            background: 'linear-gradient(135deg, #033457, #03FF00)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: 1,
          }}
        >
          404
        </h1>
        <h4 className="text-white fw-semibold mb-2">Page Not Found</h4>
        <p className="text-secondary-light mb-4">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="d-flex gap-3 justify-content-center">
          <Link
            href="/"
            className="btn fw-semibold"
            style={{
              background: '#03FF00',
              color: '#033457',
              border: 'none',
              padding: '10px 24px',
            }}
          >
            Go to Dashboard
          </Link>
          <Link
            href="/portal"
            className="btn btn-outline-light fw-medium"
            style={{ padding: '10px 24px' }}
          >
            Client Portal
          </Link>
        </div>
      </div>
    </div>
  );
}
