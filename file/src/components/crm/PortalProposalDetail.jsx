'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { acceptProposal, declineProposal, requestProposalChanges } from '@/lib/actions/portal';
import { sanitizeHtml } from '@/lib/utils/sanitize';

const PortalProposalDetail = ({ proposal, clientName, isPreview = false }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [changeRequest, setChangeRequest] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(!!proposal.acceptedAt);
  const [declined, setDeclined] = useState(proposal.status === 'declined');
  const [changesRequested, setChangesRequested] = useState(proposal.status === 'changes_requested');

  const isExpired = proposal.expiresAt && new Date(proposal.expiresAt) < new Date();
  const canRespond = !accepted && !declined && !changesRequested && !isExpired;

  // Auto-open modal based on URL action param
  useEffect(() => {
    if (isPreview || !canRespond) return;
    const action = searchParams.get('action');
    if (action === 'accept') setShowAcceptModal(true);
    else if (action === 'changes') setShowChangesModal(true);
    else if (action === 'decline') setShowDeclineModal(true);
  }, [searchParams, isPreview, canRespond]);

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
      setShowAcceptModal(false);
      router.refresh();
    }
  };

  const handleDecline = async () => {
    if (declineReason.trim().length < 10) return;
    setLoading(true);
    setError('');

    const result = await declineProposal(proposal.id, declineReason);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setDeclined(true);
      setShowDeclineModal(false);
      router.refresh();
    }
  };

  const handleRequestChanges = async () => {
    if (changeRequest.trim().length < 10) return;
    setLoading(true);
    setError('');

    const result = await requestProposalChanges(proposal.id, changeRequest);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setChangesRequested(true);
      setShowChangesModal(false);
      router.refresh();
    }
  };

  const formatCurrency = (val) =>
    Number(val).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null;

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Status banner: Expired
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

  // Status banner: Accepted
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

  // Status banner: Declined
  if (declined) {
    return (
      <>
        <div className='alert border-0 mb-4' style={{ background: '#dc354515', color: '#dc3545' }}>
          <div className='d-flex align-items-center gap-2'>
            <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='#dc3545' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
              <line x1='18' y1='6' x2='6' y2='18' />
              <line x1='6' y1='6' x2='18' y2='18' />
            </svg>
            <span className='fw-semibold'>
              Proposal declined
              {proposal.declinedAt && ` on ${formatDate(proposal.declinedAt)}`}
            </span>
          </div>
        </div>
        <ProposalContent proposal={proposal} formatCurrency={formatCurrency} />
      </>
    );
  }

  // Status banner: Changes Requested
  if (changesRequested) {
    return (
      <>
        <div className='alert border-0 mb-4' style={{ background: '#ffc10715', color: '#856404' }}>
          <div className='d-flex align-items-center gap-2'>
            <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='#ffc107' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
              <path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' />
              <path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' />
            </svg>
            <span className='fw-semibold'>
              Changes requested
              {proposal.changeRequestedAt && ` on ${formatDate(proposal.changeRequestedAt)}`}
            </span>
          </div>
          <p className='small mb-0 mt-1'>
            We&apos;re reviewing your requested changes and will send a revised proposal shortly.
          </p>
        </div>
        <ProposalContent proposal={proposal} formatCurrency={formatCurrency} />
      </>
    );
  }

  return (
    <>
      <ProposalContent proposal={proposal} formatCurrency={formatCurrency} />

      {/* Three response buttons */}
      {canRespond && (
        <div className='text-center mt-4'>
          {isPreview ? (
            <div className='d-flex flex-wrap justify-content-center gap-2'>
              <button className='btn btn-lg fw-semibold px-4 disabled' style={{ background: '#e9ecef', color: '#6c757d', border: 'none', cursor: 'not-allowed' }} disabled>Accept & Sign</button>
              <button className='btn btn-lg fw-semibold px-4 disabled' style={{ background: '#e9ecef', color: '#6c757d', border: 'none', cursor: 'not-allowed' }} disabled>Request Changes</button>
              <button className='btn btn-lg fw-semibold px-4 disabled' style={{ background: '#e9ecef', color: '#6c757d', border: 'none', cursor: 'not-allowed' }} disabled>Decline</button>
            </div>
          ) : (
            <div className='d-flex flex-wrap justify-content-center gap-2'>
              <button
                className='btn btn-lg fw-semibold px-4'
                style={{ background: '#03FF00', color: '#033457', border: 'none' }}
                onClick={() => setShowAcceptModal(true)}
              >
                Accept & Sign
              </button>
              <button
                className='btn btn-lg btn-outline-warning fw-semibold px-4'
                onClick={() => setShowChangesModal(true)}
              >
                Request Changes
              </button>
              <button
                className='btn btn-lg btn-outline-danger fw-semibold px-4'
                onClick={() => setShowDeclineModal(true)}
              >
                Decline
              </button>
            </div>
          )}
        </div>
      )}

      {/* Accept & Sign Modal */}
      {showAcceptModal && (
        <ModalOverlay onClose={() => { setShowAcceptModal(false); setError(''); }}>
          <div className='modal-header border-0 pb-0'>
            <h5 className='modal-title fw-bold' style={{ color: '#033457' }}>
              Accept & Sign Proposal
            </h5>
            <button type='button' className='btn-close' onClick={() => { setShowAcceptModal(false); setError(''); }} />
          </div>
          <div className='modal-body'>
            <p className='text-muted small mb-3'>
              By signing below, you agree to the terms and scope outlined in this proposal.
            </p>
            <div className='mb-3'>
              <label className='form-label small fw-medium'>Full Legal Name</label>
              <input
                type='text'
                className='form-control'
                placeholder={clientName}
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                style={{ fontFamily: 'cursive', fontSize: '18px', padding: '10px 14px' }}
              />
            </div>
            <div className='mb-3'>
              <div className='form-check'>
                <input type='checkbox' className='form-check-input' id='agree' checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                <label className='form-check-label small' htmlFor='agree'>
                  I agree to the terms and conditions outlined in this proposal and authorize
                  BotMakers Inc. to proceed with the described scope of work.
                </label>
              </div>
            </div>
            <div className='mb-3'>
              <span className='text-muted small'>Date: {todayFormatted}</span>
            </div>
            {error && <div className='text-danger small mb-2'>{error}</div>}
          </div>
          <div className='modal-footer border-0'>
            <button className='btn btn-light btn-sm' onClick={() => { setShowAcceptModal(false); setError(''); }}>Cancel</button>
            <button
              className='btn btn-sm fw-semibold'
              style={{ background: '#03FF00', color: '#033457', border: 'none' }}
              disabled={!agreed || signature.trim().length < 2 || loading}
              onClick={handleAccept}
            >
              {loading && <span className='spinner-border spinner-border-sm me-2' />}
              Sign & Accept
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* Decline Modal */}
      {showDeclineModal && (
        <ModalOverlay onClose={() => { setShowDeclineModal(false); setError(''); }}>
          <div className='modal-header border-0 pb-0'>
            <h5 className='modal-title fw-bold' style={{ color: '#033457' }}>
              We&apos;re sorry to hear that
            </h5>
            <button type='button' className='btn-close' onClick={() => { setShowDeclineModal(false); setError(''); }} />
          </div>
          <div className='modal-body'>
            <p className='text-muted small mb-3'>
              We&apos;d love another chance to earn your business. Would you mind telling us what the issues were?
            </p>
            <div className='mb-3'>
              <textarea
                className='form-control'
                rows={4}
                placeholder='Tell us what didn&apos;t work for you...'
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                style={{ resize: 'vertical' }}
              />
              {declineReason.length > 0 && declineReason.trim().length < 10 && (
                <div className='text-muted small mt-1'>At least 10 characters required</div>
              )}
            </div>
            <div className='mb-3'>
              <span className='text-muted small'>Or would you prefer to discuss in person?</span>
              <a
                href='https://botmakers.ai/booking'
                target='_blank'
                rel='noopener noreferrer'
                className='btn btn-link btn-sm p-0 ms-2'
                style={{ color: '#033457', fontWeight: 600 }}
              >
                Schedule a Call &rarr;
              </a>
            </div>
            {error && <div className='text-danger small mb-2'>{error}</div>}
          </div>
          <div className='modal-footer border-0'>
            <button className='btn btn-light btn-sm' onClick={() => { setShowDeclineModal(false); setError(''); }}>Cancel</button>
            <button
              className='btn btn-danger btn-sm fw-semibold'
              disabled={declineReason.trim().length < 10 || loading}
              onClick={handleDecline}
            >
              {loading && <span className='spinner-border spinner-border-sm me-2' />}
              Submit Feedback
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* Request Changes Modal */}
      {showChangesModal && (
        <ModalOverlay onClose={() => { setShowChangesModal(false); setError(''); }}>
          <div className='modal-header border-0 pb-0'>
            <h5 className='modal-title fw-bold' style={{ color: '#033457' }}>
              We&apos;d love to make this work for you
            </h5>
            <button type='button' className='btn-close' onClick={() => { setShowChangesModal(false); setError(''); }} />
          </div>
          <div className='modal-body'>
            <p className='text-muted small mb-3'>
              What changes would you like?
            </p>
            <div className='mb-3'>
              <textarea
                className='form-control'
                rows={4}
                placeholder='Describe the changes you&apos;d like...'
                value={changeRequest}
                onChange={(e) => setChangeRequest(e.target.value)}
                style={{ resize: 'vertical' }}
              />
              {changeRequest.length > 0 && changeRequest.trim().length < 10 && (
                <div className='text-muted small mt-1'>At least 10 characters required</div>
              )}
            </div>
            <div className='mb-3'>
              <span className='text-muted small'>Or would you prefer to discuss changes together?</span>
              <a
                href='https://botmakers.ai/booking'
                target='_blank'
                rel='noopener noreferrer'
                className='btn btn-link btn-sm p-0 ms-2'
                style={{ color: '#033457', fontWeight: 600 }}
              >
                Schedule a Call &rarr;
              </a>
            </div>
            {error && <div className='text-danger small mb-2'>{error}</div>}
          </div>
          <div className='modal-footer border-0'>
            <button className='btn btn-light btn-sm' onClick={() => { setShowChangesModal(false); setError(''); }}>Cancel</button>
            <button
              className='btn btn-warning btn-sm fw-semibold'
              disabled={changeRequest.trim().length < 10 || loading}
              onClick={handleRequestChanges}
            >
              {loading && <span className='spinner-border spinner-border-sm me-2' />}
              Submit Changes Request
            </button>
          </div>
        </ModalOverlay>
      )}
    </>
  );
};

function ModalOverlay({ children, onClose }) {
  return (
    <div
      className='modal d-block'
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className='modal-dialog modal-dialog-centered'>
        <div className='modal-content border-0 shadow'>
          {children}
        </div>
      </div>
    </div>
  );
}

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
        <div className='card-body' style={{ overflow: 'hidden' }}>
          <h6 className='fw-semibold mb-3' style={{ color: '#033457', fontSize: '18px' }}>Scope of Work</h6>
          <div
            className='portal-proposal-content'
            style={{ color: '#333', lineHeight: 1.7, fontSize: '17px' }}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(proposal.scopeOfWork) }}
          />
        </div>
      </div>

      {/* Deliverables */}
      <div className='card border-0 shadow-sm mb-3'>
        <div className='card-body' style={{ overflow: 'hidden' }}>
          <h6 className='fw-semibold mb-3' style={{ color: '#033457', fontSize: '18px' }}>Deliverables</h6>
          <div
            className='portal-proposal-content'
            style={{ color: '#333', lineHeight: 1.7, fontSize: '17px' }}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(proposal.deliverables) }}
          />
        </div>
      </div>

      {/* Pricing */}
      {proposal.lineItems && proposal.lineItems.length > 0 && (
        <div className='card border-0 shadow-sm mb-3'>
          <div className='card-body'>
            <h6 className='fw-semibold mb-3' style={{ color: '#033457', fontSize: '18px' }}>Pricing</h6>
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
        <div className='card-body' style={{ overflow: 'hidden' }}>
          <h6 className='fw-semibold mb-3' style={{ color: '#033457', fontSize: '18px' }}>Terms & Conditions</h6>
          <div
            className='portal-proposal-content'
            style={{ color: '#333', lineHeight: 1.7, fontSize: '17px' }}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(proposal.termsAndConditions) }}
          />
        </div>
      </div>
    </>
  );
}

export default PortalProposalDetail;
