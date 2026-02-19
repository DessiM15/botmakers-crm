'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';
import dynamic from 'next/dynamic';
import { toast } from 'react-toastify';
import { getRecipients, sendEmailFromCRM, saveDraft, getDrafts, loadDraft, deleteDraft, markDraftSent } from '@/lib/actions/emails';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

const CATEGORIES = [
  { value: 'follow_up', label: 'Follow-Up', icon: 'mdi:reply' },
  { value: 'introduction', label: 'Introduction', icon: 'mdi:handshake-outline' },
  { value: 'proposal_follow_up', label: 'Proposal Follow-Up', icon: 'mdi:file-document-check-outline' },
  { value: 'check_in', label: 'Check-In', icon: 'mdi:coffee-outline' },
  { value: 'thank_you', label: 'Thank You', icon: 'mdi:heart-outline' },
  { value: 'project_update', label: 'Project Update', icon: 'mdi:progress-check' },
  { value: 'holiday', label: 'Holiday Greeting', icon: 'mdi:party-popper' },
  { value: 'win_back', label: 'Win-Back', icon: 'mdi:account-reactivate' },
  { value: 'referral_request', label: 'Referral Request', icon: 'mdi:account-multiple-plus-outline' },
];

const HOLIDAY_TYPES = [
  'New Year',
  "Valentine's Day",
  'Easter',
  'Independence Day (4th of July)',
  'Thanksgiving',
  'Christmas / Holiday Season',
  'Client Anniversary',
];

const TONES = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'casual', label: 'Casual' },
];

export default function EmailGenerator({ teamUser }) {
  // Recipient state
  const [recipientSearch, setRecipientSearch] = useState('');
  const [recipients, setRecipients] = useState([]);
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [manualEmail, setManualEmail] = useState('');
  const [manualName, setManualName] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [ccField, setCcField] = useState('');
  const dropdownRef = useRef(null);

  // Email config state
  const [category, setCategory] = useState('follow_up');
  const [holidayType, setHolidayType] = useState('');
  const [tone, setTone] = useState('professional');
  const [customInstructions, setCustomInstructions] = useState('');

  // Generated email state
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);

  // UI state
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState(null);

  // Drafts state
  const [drafts, setDrafts] = useState([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);

  // Search recipients with debounce
  useEffect(() => {
    if (recipientSearch.length < 2) {
      setRecipients([]);
      return;
    }

    const timer = setTimeout(async () => {
      const result = await getRecipients(recipientSearch);
      if (result.success) {
        setRecipients(result.recipients);
        setShowDropdown(true);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [recipientSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Load drafts on mount
  useEffect(() => {
    loadDrafts();
  }, []);

  const loadDrafts = async () => {
    setLoadingDrafts(true);
    const result = await getDrafts();
    if (result.success) {
      setDrafts(result.drafts);
    }
    setLoadingDrafts(false);
  };

  const selectRecipient = (r) => {
    setSelectedRecipient(r);
    setRecipientSearch('');
    setShowDropdown(false);
    setShowManual(false);
    setManualEmail('');
    setManualName('');
  };

  const clearRecipient = () => {
    setSelectedRecipient(null);
    setRecipientSearch('');
    setManualEmail('');
    setManualName('');
  };

  const getRecipientEmail = () => {
    if (selectedRecipient) return selectedRecipient.email;
    if (showManual && manualEmail) return manualEmail;
    return '';
  };

  const getRecipientName = () => {
    if (selectedRecipient) return selectedRecipient.name;
    if (showManual && manualName) return manualName;
    return '';
  };

  const handleGenerate = async () => {
    const email = getRecipientEmail();
    const name = getRecipientName();

    if (!email) {
      toast.error('Please select or enter a recipient');
      return;
    }
    if (!name) {
      toast.error('Recipient name is required');
      return;
    }
    if (category === 'holiday' && !holidayType) {
      toast.error('Please select a holiday type');
      return;
    }

    setGenerating(true);
    try {
      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => controller.abort(), 60000);
      const res = await fetch('/api/ai/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientName: name,
          recipientEmail: email,
          recipientCompany: selectedRecipient?.company || '',
          category,
          holidayType: category === 'holiday' ? holidayType : undefined,
          tone,
          customInstructions: customInstructions || undefined,
          senderName: teamUser.fullName,
        }),
        signal: controller.signal,
      });
      clearTimeout(fetchTimeout);

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Failed to generate email');
        return;
      }

      setSubject(data.email.subject || '');
      setBodyHtml(data.email.body_html || '');
      setBodyText(data.email.body_text || '');
      toast.success('Email generated!');
    } catch (err) {
      if (err?.name === 'AbortError') {
        toast.error('Email generation timed out. Please try again.');
      } else {
        toast.error('Failed to generate email. Please try again.');
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyHtml = async () => {
    if (!bodyHtml) {
      toast.error('No email content to copy');
      return;
    }
    try {
      await navigator.clipboard.writeText(bodyHtml);
      toast.success('HTML copied! Paste into your email client.');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleCopyText = async () => {
    if (!bodyText) {
      toast.error('No email content to copy');
      return;
    }
    try {
      await navigator.clipboard.writeText(bodyText);
      toast.success('Plain text copied to clipboard!');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleSend = async () => {
    const email = getRecipientEmail();
    if (!email || !subject || !bodyHtml) {
      toast.error('Recipient, subject, and body are required');
      return;
    }

    setSending(true);
    try {
      const result = await sendEmailFromCRM({
        to: email,
        cc: ccField || undefined,
        subject,
        html: bodyHtml,
        recipientLeadId: selectedRecipient?.type === 'lead' ? selectedRecipient.id : undefined,
        recipientClientId: selectedRecipient?.type === 'client' ? selectedRecipient.id : undefined,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      // Mark draft as sent if we have one
      if (currentDraftId) {
        await markDraftSent(currentDraftId);
        setCurrentDraftId(null);
      }

      toast.success('Email sent successfully!');
      loadDrafts();
    } catch {
      toast.error('Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraft = async () => {
    const email = getRecipientEmail();
    if (!email) {
      toast.error('Please select or enter a recipient email');
      return;
    }

    setSavingDraft(true);
    try {
      const result = await saveDraft({
        id: currentDraftId || undefined,
        recipientEmail: email,
        recipientName: getRecipientName() || undefined,
        recipientLeadId: selectedRecipient?.type === 'lead' ? selectedRecipient.id : null,
        recipientClientId: selectedRecipient?.type === 'client' ? selectedRecipient.id : null,
        subject: subject || undefined,
        bodyHtml: bodyHtml || undefined,
        bodyText: bodyText || undefined,
        category: category || undefined,
        tone: tone || undefined,
        customInstructions: customInstructions || undefined,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setCurrentDraftId(result.id);
      toast.success('Draft saved!');
      loadDrafts();
    } catch {
      toast.error('Failed to save draft');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleLoadDraft = async (draftId) => {
    const result = await loadDraft(draftId);
    if (result.error) {
      toast.error(result.error);
      return;
    }

    const d = result.draft;
    setCurrentDraftId(d.id);
    setSubject(d.subject || '');
    setBodyHtml(d.bodyHtml || '');
    setBodyText(d.bodyText || '');
    setCategory(d.category || 'follow_up');
    setTone(d.tone || 'professional');
    setCustomInstructions(d.customInstructions || '');

    // Set recipient
    if (d.recipientLeadId || d.recipientClientId) {
      setSelectedRecipient({
        id: d.recipientLeadId || d.recipientClientId,
        name: d.recipientName || '',
        email: d.recipientEmail,
        type: d.recipientClientId ? 'client' : 'lead',
      });
      setShowManual(false);
    } else {
      setSelectedRecipient(null);
      setShowManual(true);
      setManualEmail(d.recipientEmail);
      setManualName(d.recipientName || '');
    }

    setShowDrafts(false);
    toast.success('Draft loaded');
  };

  const handleDeleteDraft = async (draftId) => {
    if (!confirm('Delete this draft?')) return;
    const result = await deleteDraft(draftId);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    if (currentDraftId === draftId) {
      setCurrentDraftId(null);
    }
    toast.success('Draft deleted');
    loadDrafts();
  };

  const handleNewEmail = () => {
    clearRecipient();
    setCategory('follow_up');
    setHolidayType('');
    setTone('professional');
    setCustomInstructions('');
    setSubject('');
    setBodyHtml('');
    setBodyText('');
    setCcField('');
    setCurrentDraftId(null);
    setShowHtmlPreview(false);
    setShowManual(false);
  };

  const getCategoryLabel = (val) => CATEGORIES.find((c) => c.value === val)?.label || val;

  const hasContent = subject || bodyHtml;

  return (
    <div className="row">
      {/* Main Content */}
      <div className={showDrafts ? 'col-lg-8' : 'col-12'}>
        <div className="d-flex align-items-center justify-content-between mb-24">
          <h5 className="text-white fw-semibold mb-0">Email Generator</h5>
          <div className="d-flex gap-2">
            <button
              className="btn btn-outline-primary-600 btn-sm d-flex align-items-center gap-1"
              onClick={() => setShowDrafts(!showDrafts)}
            >
              <Icon icon="mdi:file-document-multiple-outline" className="text-lg" />
              Drafts {drafts.length > 0 && `(${drafts.length})`}
            </button>
            <button
              className="btn btn-outline-primary-600 btn-sm d-flex align-items-center gap-1"
              onClick={handleNewEmail}
            >
              <Icon icon="mdi:plus" className="text-lg" />
              New
            </button>
          </div>
        </div>

        {/* Recipient Section */}
        <div className="card mb-16">
          <div className="card-header">
            <h6 className="text-white fw-semibold mb-0">
              <Icon icon="mdi:account-outline" className="me-2" />
              Recipient
            </h6>
          </div>
          <div className="card-body">
            {selectedRecipient ? (
              <div className="d-flex align-items-center gap-2 mb-12">
                <span className={`badge ${selectedRecipient.type === 'client' ? 'bg-success-600' : 'bg-info-600'} text-sm`}>
                  {selectedRecipient.type === 'client' ? 'Client' : 'Lead'}
                </span>
                <span className="text-white fw-medium">{selectedRecipient.name}</span>
                <span className="text-secondary-light">&lt;{selectedRecipient.email}&gt;</span>
                {selectedRecipient.company && (
                  <span className="text-secondary-light">— {selectedRecipient.company}</span>
                )}
                <button
                  className="btn btn-sm btn-outline-danger ms-auto"
                  onClick={clearRecipient}
                >
                  <Icon icon="mdi:close" />
                </button>
              </div>
            ) : showManual ? (
              <div className="row mb-12">
                <div className="col-md-5 mb-8 mb-md-0">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Recipient name"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                  />
                </div>
                <div className="col-md-5 mb-8 mb-md-0">
                  <input
                    type="email"
                    className="form-control"
                    placeholder="Recipient email"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                  />
                </div>
                <div className="col-md-2">
                  <button
                    className="btn btn-outline-secondary btn-sm w-100 h-100"
                    onClick={() => {
                      setShowManual(false);
                      setManualEmail('');
                      setManualName('');
                    }}
                  >
                    Search CRM
                  </button>
                </div>
              </div>
            ) : (
              <div className="position-relative mb-12" ref={dropdownRef}>
                <div className="d-flex gap-2">
                  <div className="flex-grow-1">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Search leads & clients by name, email, or company..."
                      value={recipientSearch}
                      onChange={(e) => setRecipientSearch(e.target.value)}
                      onFocus={() => recipients.length > 0 && setShowDropdown(true)}
                    />
                  </div>
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setShowManual(true)}
                    title="Enter email manually"
                  >
                    <Icon icon="mdi:pencil" className="text-lg" />
                    Manual
                  </button>
                </div>
                {showDropdown && recipients.length > 0 && (
                  <div
                    className="position-absolute w-100 bg-neutral-700 border border-neutral-600 rounded-8 mt-4 shadow-lg"
                    style={{ zIndex: 1050, maxHeight: 240, overflowY: 'auto' }}
                  >
                    {recipients.map((r) => (
                      <button
                        key={`${r.type}-${r.id}`}
                        className="d-flex align-items-center gap-2 w-100 px-12 py-8 border-0 bg-transparent text-white hover-bg-neutral-600"
                        style={{ cursor: 'pointer' }}
                        onClick={() => selectRecipient(r)}
                      >
                        <span className={`badge ${r.type === 'client' ? 'bg-success-600' : 'bg-info-600'} text-xs`}>
                          {r.type === 'client' ? 'Client' : 'Lead'}
                        </span>
                        <span className="fw-medium">{r.name}</span>
                        <span className="text-secondary-light text-sm">{r.email}</span>
                        {r.company && (
                          <span className="text-secondary-light text-sm ms-auto">{r.company}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* CC Field */}
            <div>
              <label className="form-label text-secondary-light text-sm mb-4">CC (optional, comma-separated)</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="cc@example.com, other@example.com"
                value={ccField}
                onChange={(e) => setCcField(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Template & Tone Section */}
        <div className="card mb-16">
          <div className="card-header">
            <h6 className="text-white fw-semibold mb-0">
              <Icon icon="mdi:palette-outline" className="me-2" />
              Template & Tone
            </h6>
          </div>
          <div className="card-body">
            {/* Category selector */}
            <label className="form-label text-secondary-light text-sm mb-8">Category</label>
            <div className="d-flex flex-wrap gap-2 mb-16">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  className={`btn btn-sm d-flex align-items-center gap-1 ${
                    category === cat.value
                      ? 'btn-primary-600'
                      : 'btn-outline-neutral-600 text-secondary-light'
                  }`}
                  onClick={() => setCategory(cat.value)}
                >
                  <Icon icon={cat.icon} className="text-lg" />
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Holiday type */}
            {category === 'holiday' && (
              <div className="mb-16">
                <label className="form-label text-secondary-light text-sm mb-4">Holiday</label>
                <select
                  className="form-select"
                  value={holidayType}
                  onChange={(e) => setHolidayType(e.target.value)}
                >
                  <option value="">Select a holiday...</option>
                  {HOLIDAY_TYPES.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Tone selector */}
            <label className="form-label text-secondary-light text-sm mb-8">Tone</label>
            <div className="d-flex gap-2 mb-16">
              {TONES.map((t) => (
                <button
                  key={t.value}
                  className={`btn btn-sm ${
                    tone === t.value
                      ? 'btn-primary-600'
                      : 'btn-outline-neutral-600 text-secondary-light'
                  }`}
                  onClick={() => setTone(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Custom instructions */}
            <label className="form-label text-secondary-light text-sm mb-4">
              Custom Instructions (optional)
            </label>
            <textarea
              className="form-control"
              rows={3}
              placeholder='e.g. "Mention their new website project", "Keep it casual", "Reference the last meeting"...'
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
            />

            {/* Generate button */}
            <div className="mt-16">
              <button
                className="btn btn-primary-600 d-flex align-items-center gap-2"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? (
                  <>
                    <span className="spinner-border spinner-border-sm" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Icon icon="mdi:auto-fix" className="text-xl" />
                    {hasContent ? 'Regenerate' : 'Generate Email'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Editor Section */}
        {hasContent ? (
          <div className="card mb-16">
            <div className="card-header d-flex align-items-center justify-content-between">
              <h6 className="text-white fw-semibold mb-0">
                <Icon icon="mdi:email-edit-outline" className="me-2" />
                Email Editor
              </h6>
              <button
                className={`btn btn-sm ${showHtmlPreview ? 'btn-primary-600' : 'btn-outline-neutral-600 text-secondary-light'}`}
                onClick={() => setShowHtmlPreview(!showHtmlPreview)}
              >
                <Icon icon="mdi:code-tags" className="me-1" />
                {showHtmlPreview ? 'Rich Editor' : 'HTML View'}
              </button>
            </div>
            <div className="card-body">
              {/* Subject line */}
              <div className="mb-16">
                <label className="form-label text-secondary-light text-sm mb-4">Subject</label>
                <input
                  type="text"
                  className="form-control"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject..."
                />
              </div>

              {/* Body editor / HTML view */}
              <div className="mb-16">
                <label className="form-label text-secondary-light text-sm mb-4">Body</label>
                {showHtmlPreview ? (
                  <textarea
                    className="form-control font-monospace text-sm"
                    rows={16}
                    value={bodyHtml}
                    onChange={(e) => setBodyHtml(e.target.value)}
                    style={{ fontSize: '12px', lineHeight: '1.5' }}
                  />
                ) : (
                  <ReactQuill
                    theme="snow"
                    value={bodyHtml}
                    onChange={setBodyHtml}
                    style={{ minHeight: '300px' }}
                  />
                )}
              </div>

              {/* Email Preview */}
              <div className="mb-16">
                <button
                  className="btn btn-sm btn-outline-neutral-600 text-secondary-light mb-8"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target="#emailPreview"
                >
                  <Icon icon="mdi:eye-outline" className="me-1" />
                  Preview Email
                </button>
                <div className="collapse" id="emailPreview">
                  <div
                    className="border border-neutral-600 rounded-8 p-16"
                    style={{ background: '#ffffff' }}
                    dangerouslySetInnerHTML={{ __html: bodyHtml }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Empty state */
          <div className="card mb-16">
            <div className="card-body text-center py-40">
              <Icon icon="solar:letter-outline" className="text-secondary-light mb-12" style={{ fontSize: 48 }} />
              <h6 className="text-white mb-8">No Email Generated Yet</h6>
              <p className="text-secondary-light mb-0">
                Select a recipient, choose a template category, and click Generate to create an AI-powered email.
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {hasContent && (
          <div className="card mb-16">
            <div className="card-body">
              <div className="d-flex flex-wrap gap-2">
                <button
                  className="btn btn-outline-info d-flex align-items-center gap-2"
                  onClick={handleCopyHtml}
                >
                  <Icon icon="mdi:content-copy" className="text-lg" />
                  Copy HTML
                </button>
                <button
                  className="btn btn-outline-info d-flex align-items-center gap-2"
                  onClick={handleCopyText}
                >
                  <Icon icon="mdi:text" className="text-lg" />
                  Copy Plain Text
                </button>
                <button
                  className="btn btn-outline-warning d-flex align-items-center gap-2"
                  onClick={handleSaveDraft}
                  disabled={savingDraft}
                >
                  {savingDraft ? (
                    <>
                      <span className="spinner-border spinner-border-sm" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Icon icon="mdi:content-save-outline" className="text-lg" />
                      Save as Draft
                    </>
                  )}
                </button>
                <button
                  className="btn btn-success-600 d-flex align-items-center gap-2 ms-auto"
                  onClick={handleSend}
                  disabled={sending}
                >
                  {sending ? (
                    <>
                      <span className="spinner-border spinner-border-sm" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Icon icon="mdi:send" className="text-lg" />
                      Send from CRM
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Drafts Sidebar */}
      {showDrafts && (
        <div className="col-lg-4">
          <div className="card" style={{ position: 'sticky', top: 90 }}>
            <div className="card-header d-flex align-items-center justify-content-between">
              <h6 className="text-white fw-semibold mb-0">
                <Icon icon="mdi:file-document-multiple-outline" className="me-2" />
                Saved Drafts
              </h6>
              <button
                className="btn btn-sm btn-outline-neutral-600"
                onClick={() => setShowDrafts(false)}
              >
                <Icon icon="mdi:close" />
              </button>
            </div>
            <div className="card-body p-0" style={{ maxHeight: 500, overflowY: 'auto' }}>
              {loadingDrafts ? (
                <div className="text-center py-20">
                  <span className="spinner-border spinner-border-sm text-primary-600" />
                </div>
              ) : drafts.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-secondary-light mb-0 text-sm">No drafts saved yet</p>
                </div>
              ) : (
                drafts.map((d) => (
                  <div
                    key={d.id}
                    className={`px-16 py-12 border-bottom border-neutral-600 ${currentDraftId === d.id ? 'bg-neutral-700' : ''}`}
                  >
                    <div className="d-flex align-items-start justify-content-between mb-4">
                      <button
                        className="btn btn-sm p-0 text-white fw-medium text-start border-0 bg-transparent text-truncate"
                        onClick={() => handleLoadDraft(d.id)}
                        style={{ maxWidth: '80%' }}
                      >
                        {d.subject || 'Untitled Draft'}
                      </button>
                      <button
                        className="btn btn-sm p-0 text-danger border-0 bg-transparent"
                        onClick={() => handleDeleteDraft(d.id)}
                        title="Delete draft"
                      >
                        <Icon icon="mdi:trash-can-outline" className="text-lg" />
                      </button>
                    </div>
                    <div className="text-secondary-light text-xs">
                      {d.recipientName || d.recipientEmail}
                      {d.category && (
                        <span className="ms-2 badge bg-neutral-600 text-xs">
                          {getCategoryLabel(d.category)}
                        </span>
                      )}
                    </div>
                    <div className="text-secondary-light text-xs mt-4">
                      {new Date(d.updatedAt).toLocaleDateString()} {new Date(d.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
