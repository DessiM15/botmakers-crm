'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { acceptProposal } from '@/lib/actions/portal';
import { sanitizeHtml } from '@/lib/utils/sanitize';

const PortalProposalDetail = ({ proposal, clientName }) => {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(!!proposal.acceptedAt);

  const isExpired = proposal.expiresAt && new Date(proposal.expiresAt) < new Date();
  const isDeclined = !!proposal.declinedAt;

  const handleAccept = async () => {
    if (!agreed || signature.trim().length < 2) return;
    setLoading(true);
    setError('');

    const result = await acceptProposal(proposal.id, signature);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setAccepted(true);
      setShowModal(false);
      router.refresh();
    }
  };

  const formatCurrency = (val) =>
    Number(val).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null;

  // Status banner
  if (isExpired && !accepted) {
    return (
      <div className='card border-0 shadow-sm'>
        <div className='card-body text-center py-5'>
          <div className='mb-3' style={{ fontSize: '48px', color: '#dc3545', opacity: 0.6 }}>
            <svg width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round'>
              <circle cx='12' cy='12' r='10' />
              <line x1='15' y1='9' x2='9' y2='15' />
              <line x1='9' y1='9' x2='15' y2='15' />
            </svg>
          </div>
          <h5 className='fw-semibold mb-2' style={{ color: '#033457' }}>
            Proposal Expired
          </h5>
          <p className='text-muted small mb-0'>
            This proposal expired on {formatDate(proposal.expiresAt)}.
            <br />
            Contact <a href='mailto:info@botmakers.ai' style={{ color: '#033457' }}>info@botmakers.ai</a> for a new proposal.
          </p>
        </div>
      </div>
    );
  }

  if (accepted) {
    return (
      <>
        <div className='alert border-0 mb-4' style={{ background: '#03FF0015', color: '#033457' }}>
          <div className='d-flex align-items-center gap-2'>
            <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='#198754' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
              <polyline points='20 6 9 17 4 12' />
            </svg>
            <span className='fw-semibold'>
              Proposal accepted
              {proposal.acceptedAt && ` on ${formatDate(proposal.acceptedAt)}`}
            </span>
          </div>
          {proposal.clientSignature && (
            <p className='small mb-0 mt-1'>
              Signed by: {proposal.clientSignature}
            </p>
          )}
        </div>
        <ProposalContent proposal={proposal} formatCurrency={formatCurrency} />
      </>
    );
  }

  return (
    <>
      <ProposalContent proposal={proposal} formatCurrency={formatCurrency} />

      {/* Accept button */}
      {!isDeclined && !isExpired && (
        <div className='text-center mt-4'>
          <button
            className='btn btn-lg fw-semibold px-5'
            style={{ background: '#03FF00', color: '#033457', border: 'none' }}
            onClick={() => setShowModal(true)}
          >
            Accept & Sign
          </button>
        </div>
      )}

      {isDeclined && (
        <div className='alert border-0 text-center' style={{ background: '#dc354515', color: '#dc3545' }}>
          This proposal was declined on {formatDate(proposal.declinedAt)}.
        </div>
      )}

      {/* Accept Modal */}
      {showModal && (
        <div
          className='modal d-block'
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className='modal-dialog modal-dialog-centered'>
            <div className='modal-content border-0 shadow'>
              <div className='modal-header border-0'>
                <h5 className='modal-title fw-bold' style={{ color: '#033457' }}>
                  Accept Proposal
                </h5>
                <button
                  type='button'
                  className='btn-close'
                  onClick={() => setShowModal(false)}
                />
              </div>
              <div className='modal-body'>
                <div className='mb-3'>
                  <div className='form-check'>
                    <input
                      type='checkbox'
                      className='form-check-input'
                      id='agree'
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                    />
                    <label className='form-check-label small' htmlFor='agree'>
                      I agree to the terms and conditions outlined in this proposal.
                    </label>
                  </div>
                </div>
                <div className='mb-3'>
                  <label className='form-label small fw-medium'>
                    Type your full name as signature
                  </label>
                  <input
                    type='text'
                    className='form-control'
                    placeholder={clientName}
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    style={{
                      fontFamily: 'cursive',
                      fontSize: '18px',
                      padding: '10px 14px',
                    }}
                  />
                </div>
                {error && (
                  <div className='text-danger small mb-2'>{error}</div>
                )}
              </div>
              <div className='modal-footer border-0'>
                <button
                  className='btn btn-light btn-sm'
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  className='btn btn-sm fw-semibold'
                  style={{ background: '#03FF00', color: '#033457', border: 'none' }}
                  disabled={!agreed || signature.trim().length < 2 || loading}
                  onClick={handleAccept}
                >
                  {loading && <span className='spinner-border spinner-border-sm me-2' />}
                  Accept & Sign
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

function ProposalContent({ proposal, formatCurrency }) {
  return (
    <>
      <div className='card border-0 shadow-sm mb-4'>
        <div className='card-body'>
          <h4 className='fw-bold mb-1' style={{ color: '#033457' }}>
            {proposal.title}
          </h4>
          <p className='text-muted small mb-0'>
            {proposal.pricingType} pricing &bull; Total: {formatCurrency(proposal.totalAmount)}
          </p>
        </div>
      </div>

      {/* Scope of Work */}
      <div className='card border-0 shadow-sm mb-3'>
        <div className='card-body'>
          <h6 className='fw-semibold mb-3' style={{ color: '#033457' }}>Scope of Work</h6>
          <div
            className='small'
            style={{ color: '#333', lineHeight: 1.7 }}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(proposal.scopeOfWork) }}
          />
        </div>
      </div>

      {/* Deliverables */}
      <div className='card border-0 shadow-sm mb-3'>
        <div className='card-body'>
          <h6 className='fw-semibold mb-3' style={{ color: '#033457' }}>Deliverables</h6>
          <div
            className='small'
            style={{ color: '#333', lineHeight: 1.7 }}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(proposal.deliverables) }}
          />
        </div>
      </div>

      {/* Pricing */}
      {proposal.lineItems && proposal.lineItems.length > 0 && (
        <div className='card border-0 shadow-sm mb-3'>
          <div className='card-body'>
            <h6 className='fw-semibold mb-3' style={{ color: '#033457' }}>Pricing</h6>
            <div className='table-responsive'>
              <table className='table table-sm mb-0'>
                <thead>
                  <tr className='small' style={{ color: '#6c757d' }}>
                    <th>Item</th>
                    <th className='text-center'>Qty</th>
                    <th className='text-end'>Price</th>
                    <th className='text-end'>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {proposal.lineItems.map((item) => (
                    <tr key={item.id} className='small'>
                      <td style={{ color: '#333' }}>
                        {item.phaseLabel && (
                          <span className='badge me-1' style={{ background: '#033457', fontSize: '10px' }}>
                            {item.phaseLabel}
                          </span>
                        )}
                        {item.description}
                      </td>
                      <td className='text-center'>{item.quantity}</td>
                      <td className='text-end'>{formatCurrency(item.unitPrice)}</td>
                      <td className='text-end fw-medium'>{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className='fw-bold' style={{ color: '#033457' }}>
                    <td colSpan={3} className='text-end'>Total</td>
                    <td className='text-end'>{formatCurrency(proposal.totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Terms */}
      <div className='card border-0 shadow-sm mb-3'>
        <div className='card-body'>
          <h6 className='fw-semibold mb-3' style={{ color: '#033457' }}>Terms & Conditions</h6>
          <div
            className='small'
            style={{ color: '#333', lineHeight: 1.7 }}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(proposal.termsAndConditions) }}
          />
        </div>
      </div>
    </>
  );
}

export default PortalProposalDetail;
