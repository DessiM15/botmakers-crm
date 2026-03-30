'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react/dist/iconify.js';
import { toast } from 'react-toastify';
import { sendDiscoveryFollowUp } from '@/lib/actions/discovery';

const SENTIMENT_BADGES = {
  positive: { color: '#198754', label: 'Positive' },
  neutral: { color: '#6c757d', label: 'Neutral' },
  cautious: { color: '#ffc107', label: 'Cautious' },
  negative: { color: '#dc3545', label: 'Negative' },
};

const PRIORITY_BADGES = {
  high: { color: '#dc3545', label: 'High Priority' },
  medium: { color: '#ffc107', label: 'Medium Priority' },
  low: { color: '#6c757d', label: 'Low Priority' },
};

const DiscoveryCallSection = ({ lead, onUpdate }) => {
  const router = useRouter();
  const fileInputRef = useRef(null);

  // UI state
  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState('paste'); // paste | upload
  const [pricingType, setPricingType] = useState('fixed');

  // Input state
  const [transcript, setTranscript] = useState(lead.discoveryTranscript || '');
  const [fileName, setFileName] = useState('');
  const [fileUploading, setFileUploading] = useState(false);

  // Processing state
  const [processing, setProcessing] = useState(false);

  // Results state
  const [summary, setSummary] = useState(lead.discoveryCallSummary || null);
  const [proposal, setProposal] = useState(null);
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);

  // Send state
  const [sending, setSending] = useState(false);
  const [sentProposalId, setSentProposalId] = useState(null);

  // Determine view: has results or not
  const hasResults = !!summary;
  const wasPreviouslyProcessed = !!lead.discoveryCallProcessedAt;

  // ── File Upload ──────────────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['.txt', '.pdf', '.docx'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!validTypes.includes(ext)) {
      toast.error('Unsupported file type. Use .txt, .pdf, or .docx');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum 10MB.');
      return;
    }

    setFileUploading(true);
    setFileName(file.name);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/ai/parse-transcript-file', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (json.error) {
        toast.error(json.error);
        setFileName('');
      } else {
        setTranscript(json.text);
        setActiveTab('paste');
        toast.success(`Extracted ${json.text.length.toLocaleString()} characters from ${file.name}`);
      }
    } catch {
      toast.error('Failed to parse file');
      setFileName('');
    } finally {
      setFileUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Process Transcript ──────────────────────────────────────────────
  const handleProcess = async () => {
    if (!transcript || transcript.trim().length < 50) {
      toast.error('Transcript must be at least 50 characters');
      return;
    }

    setProcessing(true);
    setSentProposalId(null);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000);

      const res = await fetch('/api/ai/process-discovery-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          transcript: transcript.trim(),
          pricingType,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const json = await res.json();

      if (json.error) {
        toast.error(json.error);
      } else {
        setSummary(json.summary);
        setProposal(json.proposal);
        toast.success('Discovery call processed successfully');
        if (onUpdate) onUpdate();
      }
    } catch (err) {
      if (err?.name === 'AbortError') {
        toast.error('Processing timed out. Please try again.');
      } else {
        toast.error('CB-INT-002: AI processing failed');
      }
    } finally {
      setProcessing(false);
    }
  };

  // ── Send to Client ──────────────────────────────────────────────────
  const handleSendToClient = async () => {
    if (!summary || !proposal) {
      toast.error('Process the transcript first');
      return;
    }

    setSending(true);

    try {
      const res = await sendDiscoveryFollowUp({
        leadId: lead.id,
        summary,
        proposalData: {
          ...proposal,
          pricingType,
        },
      });

      if (res?.error) {
        toast.error(res.error);
      } else {
        setSentProposalId(res.proposalId);
        toast.success('Proposal created & emails sent!');
        if (onUpdate) onUpdate();
      }
    } catch {
      toast.error('Failed to send follow-up');
    } finally {
      setSending(false);
    }
  };

  // ── Calculate total from proposal line items ────────────────────────
  const proposalTotal = proposal?.suggested_line_items?.reduce(
    (sum, item) => sum + (Number(item.quantity) || 1) * (Number(item.unit_price) || 0),
    0
  ) || 0;

  return (
    <>
      <div className="card mb-4">
        <div
          className="card-header d-flex align-items-center justify-content-between cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="d-flex align-items-center gap-2">
            <Icon
              icon="mdi:phone-message-outline"
              style={{ fontSize: '20px' }}
              className="text-primary-light"
            />
            <h6 className="text-white fw-semibold mb-0">Discovery Call</h6>
            {wasPreviouslyProcessed && !sentProposalId && (
              <span className="badge bg-success bg-opacity-25 text-success text-xs">Processed</span>
            )}
            {sentProposalId && (
              <span className="badge bg-info bg-opacity-25 text-info text-xs">Sent</span>
            )}
          </div>
          <Icon
            icon={expanded ? 'mdi:chevron-up' : 'mdi:chevron-down'}
            style={{ fontSize: '20px' }}
            className="text-secondary-light"
          />
        </div>

        {expanded && (
          <div className="card-body">
            {/* ── Sent Confirmation ─────────────────────────────── */}
            {sentProposalId && (
              <div className="text-center py-4">
                <Icon
                  icon="mdi:check-circle"
                  className="text-success mb-2"
                  style={{ fontSize: '48px' }}
                />
                <h6 className="text-white fw-semibold mb-2">Follow-Up Sent!</h6>
                <p className="text-secondary-light text-sm mb-3">
                  Proposal created and discovery summary emailed to {lead.email}
                </p>
                <div className="d-flex justify-content-center gap-2">
                  <button
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => router.push(`/proposals/${sentProposalId}`)}
                  >
                    <Icon icon="mdi:file-document-outline" className="me-1" />
                    View Proposal
                  </button>
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => {
                      setSentProposalId(null);
                      setProposal(null);
                    }}
                  >
                    Process Another
                  </button>
                </div>
              </div>
            )}

            {/* ── Processing Spinner ───────────────────────────── */}
            {processing && !sentProposalId && (
              <div className="text-center py-5">
                <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
                  <span className="visually-hidden">Processing...</span>
                </div>
                <h6 className="text-white fw-semibold mb-1">Analyzing Discovery Call</h6>
                <p className="text-secondary-light text-sm mb-0">
                  Summarizing key points and generating proposal...
                </p>
              </div>
            )}

            {/* ── Results View ─────────────────────────────────── */}
            {hasResults && !processing && !sentProposalId && (
              <>
                {/* Summary Section */}
                <div className="mb-4">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <h6 className="text-white fw-semibold mb-0">Call Summary</h6>
                    <div className="d-flex gap-2">
                      {summary.sentiment && SENTIMENT_BADGES[summary.sentiment] && (
                        <span
                          className="badge text-xs"
                          style={{
                            background: `${SENTIMENT_BADGES[summary.sentiment].color}22`,
                            color: SENTIMENT_BADGES[summary.sentiment].color,
                          }}
                        >
                          {SENTIMENT_BADGES[summary.sentiment].label}
                        </span>
                      )}
                      {summary.priority && PRIORITY_BADGES[summary.priority] && (
                        <span
                          className="badge text-xs"
                          style={{
                            background: `${PRIORITY_BADGES[summary.priority].color}22`,
                            color: PRIORITY_BADGES[summary.priority].color,
                          }}
                        >
                          {PRIORITY_BADGES[summary.priority].label}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="row g-3">
                    {/* Key Points */}
                    {summary.key_points?.length > 0 && (
                      <div className="col-12">
                        <label className="text-secondary-light text-xs d-block mb-1">Key Points</label>
                        <ul className="list-unstyled mb-0">
                          {summary.key_points.map((point, i) => (
                            <li key={i} className="text-white text-sm mb-1 d-flex gap-2">
                              <Icon icon="mdi:circle-small" className="text-success flex-shrink-0 mt-0" style={{ fontSize: '20px' }} />
                              {point}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Client Needs */}
                    {summary.client_needs?.length > 0 && (
                      <div className="col-12">
                        <label className="text-secondary-light text-xs d-block mb-1">Client Needs</label>
                        <ul className="list-unstyled mb-0">
                          {summary.client_needs.map((need, i) => (
                            <li key={i} className="text-white text-sm mb-1 d-flex gap-2">
                              <Icon icon="mdi:target" className="text-info flex-shrink-0 mt-1" style={{ fontSize: '14px' }} />
                              {need}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Budget & Timeline */}
                    <div className="col-sm-6">
                      <label className="text-secondary-light text-xs d-block mb-1">Budget</label>
                      <span className="text-white text-sm">{summary.budget || 'Not discussed'}</span>
                    </div>
                    <div className="col-sm-6">
                      <label className="text-secondary-light text-xs d-block mb-1">Timeline</label>
                      <span className="text-white text-sm">{summary.timeline || 'Not discussed'}</span>
                    </div>

                    {/* Technical Requirements */}
                    {summary.technical_requirements?.length > 0 && (
                      <div className="col-12">
                        <label className="text-secondary-light text-xs d-block mb-1">Technical Requirements</label>
                        <div className="d-flex flex-wrap gap-1">
                          {summary.technical_requirements.map((req, i) => (
                            <span key={i} className="badge bg-base text-xs text-white">{req}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Items */}
                    {summary.action_items?.length > 0 && (
                      <div className="col-12">
                        <label className="text-secondary-light text-xs d-block mb-1">Action Items</label>
                        <ul className="list-unstyled mb-0">
                          {summary.action_items.map((item, i) => (
                            <li key={i} className="text-white text-sm mb-1 d-flex gap-2">
                              <Icon icon="mdi:checkbox-blank-outline" className="text-warning flex-shrink-0 mt-1" style={{ fontSize: '14px' }} />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Decisions */}
                    {summary.decisions?.length > 0 && (
                      <div className="col-12">
                        <label className="text-secondary-light text-xs d-block mb-1">Decisions Made</label>
                        <ul className="list-unstyled mb-0">
                          {summary.decisions.map((d, i) => (
                            <li key={i} className="text-white text-sm mb-1 d-flex gap-2">
                              <Icon icon="mdi:check-decagram" className="text-success flex-shrink-0 mt-1" style={{ fontSize: '14px' }} />
                              {d}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Proposal Preview */}
                {proposal && (
                  <div className="mb-4">
                    <hr className="border-secondary-subtle" />
                    <h6 className="text-white fw-semibold mb-3">Proposal Preview</h6>
                    <div className="p-3 rounded" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <h6 className="text-white mb-2">{proposal.title}</h6>
                      {proposal.suggested_line_items?.length > 0 && (
                        <div className="table-responsive mb-2">
                          <table className="table table-sm table-borderless mb-0">
                            <thead>
                              <tr>
                                <th className="text-secondary-light text-xs">Item</th>
                                <th className="text-secondary-light text-xs text-end" style={{ width: '60px' }}>Qty</th>
                                <th className="text-secondary-light text-xs text-end" style={{ width: '100px' }}>Price</th>
                                <th className="text-secondary-light text-xs text-end" style={{ width: '100px' }}>Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {proposal.suggested_line_items.map((item, i) => {
                                const qty = Number(item.quantity) || 1;
                                const price = Number(item.unit_price) || 0;
                                return (
                                  <tr key={i}>
                                    <td className="text-white text-sm">
                                      {item.description}
                                      {item.phase_label && (
                                        <span className="badge bg-base text-xs ms-2">{item.phase_label}</span>
                                      )}
                                    </td>
                                    <td className="text-white text-sm text-end">{qty}</td>
                                    <td className="text-white text-sm text-end">${price.toLocaleString()}</td>
                                    <td className="text-white text-sm text-end">${(qty * price).toLocaleString()}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr>
                                <td colSpan={3} className="text-white fw-semibold text-end">Total</td>
                                <td className="text-success fw-semibold text-end">${proposalTotal.toLocaleString()}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="d-flex flex-wrap gap-2">
                  {proposal && (
                    <button
                      className="btn btn-success btn-sm d-flex align-items-center gap-1"
                      onClick={handleSendToClient}
                      disabled={sending}
                    >
                      {sending ? (
                        <>
                          <span className="spinner-border spinner-border-sm" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Icon icon="mdi:send" style={{ fontSize: '16px' }} />
                          Send to Client
                        </>
                      )}
                    </button>
                  )}
                  {proposal && (
                    <button
                      className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
                      onClick={() => {
                        sessionStorage.setItem(
                          'discoveryProposalData',
                          JSON.stringify({ ...proposal, pricingType, leadId: lead.id })
                        );
                        router.push(`/proposals/new?lead_id=${lead.id}&from=discovery`);
                      }}
                    >
                      <Icon icon="mdi:pencil" style={{ fontSize: '16px' }} />
                      Edit Proposal
                    </button>
                  )}
                  <button
                    className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                    onClick={handleProcess}
                    disabled={processing || !transcript}
                  >
                    <Icon icon="mdi:refresh" style={{ fontSize: '16px' }} />
                    Re-process
                  </button>
                  {transcript && (
                    <button
                      className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                      onClick={() => setShowTranscriptModal(true)}
                    >
                      <Icon icon="mdi:text-box-outline" style={{ fontSize: '16px' }} />
                      View Transcript
                    </button>
                  )}
                </div>
              </>
            )}

            {/* ── Input View (no results yet) ─────────────────── */}
            {!hasResults && !processing && !sentProposalId && (
              <>
                {/* Tabs */}
                <div className="d-flex gap-1 mb-3">
                  <button
                    className={`btn btn-sm ${activeTab === 'paste' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setActiveTab('paste')}
                  >
                    <Icon icon="mdi:content-paste" className="me-1" />
                    Paste Text
                  </button>
                  <button
                    className={`btn btn-sm ${activeTab === 'upload' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setActiveTab('upload')}
                  >
                    <Icon icon="mdi:upload" className="me-1" />
                    Upload File
                  </button>
                </div>

                {/* Paste Tab */}
                {activeTab === 'paste' && (
                  <div className="mb-3">
                    <textarea
                      className="form-control bg-base text-white"
                      rows={8}
                      placeholder="Paste your discovery call transcript here..."
                      value={transcript}
                      onChange={(e) => setTranscript(e.target.value)}
                    />
                    <p className="text-secondary-light text-xs mt-1 mb-0">
                      {transcript.length > 0 ? `${transcript.length.toLocaleString()} characters` : 'Paste the full transcript from Dialpad or any other source'}
                    </p>
                  </div>
                )}

                {/* Upload Tab */}
                {activeTab === 'upload' && (
                  <div className="mb-3">
                    <div
                      className="border border-dashed rounded p-4 text-center cursor-pointer"
                      style={{ borderColor: 'rgba(255,255,255,0.15)' }}
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const file = e.dataTransfer.files?.[0];
                        if (file && fileInputRef.current) {
                          const dt = new DataTransfer();
                          dt.items.add(file);
                          fileInputRef.current.files = dt.files;
                          handleFileUpload({ target: { files: [file] } });
                        }
                      }}
                    >
                      {fileUploading ? (
                        <>
                          <span className="spinner-border spinner-border-sm text-primary mb-2" />
                          <p className="text-secondary-light text-sm mb-0">Extracting text from {fileName}...</p>
                        </>
                      ) : (
                        <>
                          <Icon icon="mdi:cloud-upload-outline" className="text-secondary-light mb-2" style={{ fontSize: '36px' }} />
                          <p className="text-secondary-light text-sm mb-1">
                            Drop a file here or click to browse
                          </p>
                          <p className="text-secondary-light text-xs mb-0">
                            Supported: .txt, .pdf, .docx (max 10MB)
                          </p>
                        </>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.pdf,.docx"
                      onChange={handleFileUpload}
                      className="d-none"
                    />
                    {transcript && fileName && (
                      <p className="text-success text-xs mt-2 mb-0">
                        <Icon icon="mdi:check-circle" className="me-1" />
                        Extracted from {fileName} — switch to Paste Text tab to review
                      </p>
                    )}
                  </div>
                )}

                {/* Pricing Type Selector */}
                <div className="mb-3">
                  <label className="text-secondary-light text-xs d-block mb-1">Pricing Type</label>
                  <div className="d-flex gap-1">
                    {['fixed', 'phased', 'hourly'].map((type) => (
                      <button
                        key={type}
                        className={`btn btn-sm text-capitalize ${pricingType === type ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setPricingType(type)}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Process Button */}
                <button
                  className="btn btn-primary btn-sm d-flex align-items-center gap-1"
                  onClick={handleProcess}
                  disabled={processing || !transcript || transcript.trim().length < 50}
                >
                  <Icon icon="mdi:robot-outline" style={{ fontSize: '16px' }} />
                  Process Call
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Transcript Modal */}
      {showTranscriptModal && (
        <div
          className="modal show d-block"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowTranscriptModal(false);
          }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
            <div className="modal-content bg-base">
              <div className="modal-header border-secondary-subtle">
                <h5 className="modal-title text-white fw-semibold">Call Transcript</h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowTranscriptModal(false)}
                />
              </div>
              <div className="modal-body">
                <pre className="text-white text-sm mb-0" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                  {transcript}
                </pre>
              </div>
              <div className="modal-footer border-secondary-subtle">
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setShowTranscriptModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DiscoveryCallSection;
