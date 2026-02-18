'use client';

import { useState } from 'react';
import { sendMagicLink } from '@/lib/actions/portal';

export default function PortalLoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await sendMagicLink(email);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setSent(true);
      setLoading(false);
    }
  };

  return (
    <div
      className='d-flex justify-content-center align-items-center'
      style={{ minHeight: '100vh', background: '#f8f9fa' }}
    >
      <div className='card shadow-sm border-0' style={{ maxWidth: 440, width: '100%' }}>
        <div className='card-body p-4 p-md-5'>
          <div className='text-center mb-4'>
            <img
              src='/assets/images/botmakers-full-logo.png'
              alt='Botmakers'
              style={{ height: 40, marginBottom: 16 }}
            />
            <h4 className='fw-bold mb-1' style={{ color: '#033457' }}>
              Client Portal
            </h4>
            <p style={{ color: '#1E40AF', fontSize: '0.875rem' }}>
              Enter your email to receive a secure login link
            </p>
          </div>

          {sent ? (
            <div className='text-center'>
              <div
                className='d-flex align-items-center justify-content-center rounded-circle mx-auto mb-3'
                style={{
                  width: 56,
                  height: 56,
                  background: '#03FF0022',
                }}
              >
                <svg width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='#198754' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
                  <polyline points='20 6 9 17 4 12' />
                </svg>
              </div>
              <h5 className='fw-semibold mb-2' style={{ color: '#033457' }}>
                Check your email
              </h5>
              <p className='text-muted small mb-0'>
                We sent a login link to <strong>{email}</strong>.
                <br />
                It expires in 1 hour.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className='mb-3'>
                <label htmlFor='email' className='form-label small fw-medium' style={{ color: '#333' }}>
                  Email address
                </label>
                <input
                  id='email'
                  type='email'
                  className='form-control'
                  placeholder='you@company.com'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  autoFocus
                  style={{ padding: '10px 14px' }}
                />
              </div>

              {error && (
                <div className='alert alert-danger py-2 small mb-3' role='alert'>
                  {error}
                </div>
              )}

              <button
                type='submit'
                className='btn w-100 fw-semibold'
                disabled={loading || !email}
                style={{
                  background: '#033457',
                  color: '#fff',
                  padding: '10px',
                  border: 'none',
                }}
              >
                {loading ? (
                  <span className='spinner-border spinner-border-sm me-2' role='status' />
                ) : null}
                {loading ? 'Sending...' : 'Send Login Link'}
              </button>

              <p className='text-center text-muted small mt-3 mb-0'>
                No password needed — we'll email you a secure link.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
