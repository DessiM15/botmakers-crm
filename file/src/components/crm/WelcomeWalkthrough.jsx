'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { markOnboardingComplete } from '@/lib/actions/portal';

const SLIDES = [
  {
    icon: (
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#03FF00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    title: null, // Replaced dynamically with "Welcome, {name}!"
    subtitle: "Let's take a quick tour of your client portal.",
    body: "Your portal is your central hub for everything related to your projects with BotMakers. Here's what you can do.",
  },
  {
    icon: (
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#03FF00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="21" x2="9" y2="9" />
      </svg>
    ),
    title: 'Track Your Project',
    subtitle: 'Real-time progress updates',
    body: 'See your project milestones, current phase, and overall progress. Watch as deliverables are completed and new features are built.',
  },
  {
    icon: (
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#03FF00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    title: 'Stay Connected',
    subtitle: 'Ask questions & get answers',
    body: 'Have a question about your project? Use the built-in Q&A to reach our team directly. View your full conversation history in one place.',
  },
  {
    icon: (
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#03FF00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    title: 'Review & Approve',
    subtitle: 'Proposals, demos & invoices',
    body: 'Review and sign proposals, preview live demos of your project, and manage invoices — all from your portal.',
  },
];

const WelcomeWalkthrough = ({ clientName }) => {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [fadeClass, setFadeClass] = useState('slide-enter');

  const firstName = clientName ? clientName.split(' ')[0] : '';
  const isLastSlide = currentSlide === SLIDES.length - 1;

  const changeSlide = (newIndex) => {
    setFadeClass('slide-exit');
    setTimeout(() => {
      setCurrentSlide(newIndex);
      setFadeClass('slide-enter');
    }, 200);
  };

  const handleNext = () => {
    if (isLastSlide) {
      handleComplete();
    } else {
      changeSlide(currentSlide + 1);
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    await markOnboardingComplete();
    router.push('/portal');
  };

  const handleSkip = async () => {
    setCompleting(true);
    await markOnboardingComplete();
    router.push('/portal');
  };

  const slide = SLIDES[currentSlide];
  const slideTitle = currentSlide === 0 ? `Welcome, ${firstName}!` : slide.title;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#033457',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <style>{`
        .slide-enter {
          opacity: 1;
          transform: translateY(0);
          transition: opacity 0.3s ease, transform 0.3s ease;
        }
        .slide-exit {
          opacity: 0;
          transform: translateY(10px);
          transition: opacity 0.2s ease, transform 0.2s ease;
        }
        .welcome-dot {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
        }
        .welcome-dot::after {
          content: '';
          width: 10px;
          height: 10px;
          border-radius: 50%;
          display: block;
        }
        .welcome-dot.active::after {
          background: #03FF00;
        }
        .welcome-dot.inactive::after {
          background: rgba(255,255,255,0.3);
        }
      `}</style>

      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        {/* Logo */}
        <div style={{ marginBottom: 40 }}>
          <img
            src="/assets/images/botmakers-full-logo.png"
            alt="Botmakers"
            style={{ height: 36, filter: 'brightness(10)' }}
          />
        </div>

        {/* Slide Content */}
        <div className={fadeClass} style={{ minHeight: 280 }}>
          <div style={{ marginBottom: 24 }}>{slide.icon}</div>

          <h2 style={{ color: '#ffffff', fontSize: '28px', fontWeight: 700, marginBottom: 8 }}>
            {slideTitle}
          </h2>

          <p style={{
            color: '#03FF00',
            fontSize: '14px',
            fontWeight: 600,
            marginBottom: 16,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
          }}>
            {slide.subtitle}
          </p>

          <p style={{
            color: 'rgba(255,255,255,0.8)',
            fontSize: '16px',
            lineHeight: 1.6,
            maxWidth: 400,
            margin: '0 auto',
          }}>
            {slide.body}
          </p>
        </div>

        {/* Progress Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, margin: '32px 0' }}>
          {SLIDES.map((_, i) => (
            <button
              key={i}
              className={`welcome-dot ${i === currentSlide ? 'active' : 'inactive'}`}
              onClick={() => changeSlide(i)}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>

        {/* CTA Button */}
        <button
          onClick={handleNext}
          disabled={completing}
          style={{
            width: '100%',
            padding: '14px 32px',
            background: '#03FF00',
            color: '#033457',
            border: 'none',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: '16px',
            cursor: completing ? 'not-allowed' : 'pointer',
            opacity: completing ? 0.7 : 1,
            marginBottom: 12,
          }}
        >
          {completing && <span className="spinner-border spinner-border-sm me-2" />}
          {isLastSlide ? 'Go to My Portal' : 'Next'}
        </button>

        {/* Skip Link */}
        {!isLastSlide && (
          <button
            onClick={handleSkip}
            disabled={completing}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.5)',
              fontSize: '14px',
              cursor: 'pointer',
              padding: '8px 16px',
            }}
          >
            Skip tour
          </button>
        )}
      </div>
    </div>
  );
};

export default WelcomeWalkthrough;
