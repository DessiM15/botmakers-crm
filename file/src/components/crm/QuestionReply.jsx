'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react/dist/iconify.js';
import { saveDraftReply, sendReply } from '@/lib/actions/questions';
import { toast } from 'react-toastify';

const QuestionReply = ({ projectId, projectName, questions }) => {
  const router = useRouter();

  return (
    <div>
      {questions.length === 0 ? (
        <div className='card'>
          <div className='card-body d-flex flex-column justify-content-center align-items-center py-5'>
            <Icon
              icon='mdi:help-circle-outline'
              className='text-secondary-light mb-2'
              style={{ fontSize: '36px' }}
            />
            <p className='text-secondary-light text-sm mb-0'>
              No client questions yet.
            </p>
          </div>
        </div>
      ) : (
        <div className='d-flex flex-column gap-3'>
          {questions.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              projectName={projectName}
              onUpdate={() => router.refresh()}
            />
          ))}
        </div>
      )}
    </div>
  );
};

function QuestionCard({ question, projectName, onUpdate }) {
  const [draft, setDraft] = useState(question.replyDraft || '');
  const [polished, setPolished] = useState('');
  const [polishing, setPolishing] = useState(false);
  const [sending, setSending] = useState(false);
  const [showPolished, setShowPolished] = useState(false);

  const isReplied = question.status === 'replied';

  const handlePolish = async () => {
    if (!draft.trim()) {
      toast.error('Write a draft reply first.');
      return;
    }
    setPolishing(true);
    try {
      const res = await fetch('/api/ai/polish-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.questionText,
          draft: draft.trim(),
          projectName,
        }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        setPolished(data.polished);
        setShowPolished(true);
      }
    } catch {
      toast.error('Failed to polish reply.');
    }
    setPolishing(false);
  };

  const handleSend = async () => {
    const textToSend = showPolished && polished ? polished : draft;
    if (!textToSend.trim()) {
      toast.error('Reply cannot be empty.');
      return;
    }
    setSending(true);
    const result = await sendReply(question.id, textToSend);
    setSending(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Reply sent to client.');
      onUpdate();
    }
  };

  const handleSaveDraft = async () => {
    await saveDraftReply(question.id, draft);
    toast.success('Draft saved.');
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  return (
    <div className='card'>
      <div className='card-body'>
        {/* Question */}
        <div className='d-flex align-items-start justify-content-between mb-2'>
          <div className='d-flex align-items-center gap-2'>
            <Icon icon='mdi:account-circle' className='text-info' style={{ fontSize: '20px' }} />
            <span className='text-white text-sm fw-medium'>
              {question.clientName || 'Client'}
            </span>
            <span
              className='badge fw-medium'
              style={{
                background: isReplied ? '#19875422' : '#ffc10722',
                color: isReplied ? '#198754' : '#ffc107',
                fontSize: '11px',
              }}
            >
              {isReplied ? 'Replied' : 'Pending'}
            </span>
          </div>
          <span className='text-secondary-light' style={{ fontSize: '11px' }}>
            {formatDate(question.createdAt)}
          </span>
        </div>

        <div className='p-3 rounded mb-3' style={{ background: 'rgba(255,255,255,0.03)' }}>
          <p className='text-white text-sm mb-0'>{question.questionText}</p>
        </div>

        {/* Reply */}
        {isReplied ? (
          <div className='ps-3' style={{ borderLeft: '3px solid #03FF00' }}>
            <div className='d-flex align-items-center gap-2 mb-1'>
              <Icon icon='mdi:reply' className='text-success-main' style={{ fontSize: '16px' }} />
              <span className='text-white text-sm fw-medium'>
                {question.repliedByName || 'Team'}
              </span>
              {question.repliedAt && (
                <span className='text-secondary-light' style={{ fontSize: '11px' }}>
                  {formatDate(question.repliedAt)}
                </span>
              )}
            </div>
            <p className='text-secondary-light text-sm mb-0'>
              {question.replyText}
            </p>
          </div>
        ) : (
          <div>
            {/* Draft editor */}
            <label className='form-label text-secondary-light text-xs'>
              Your Reply
            </label>
            <textarea
              className='form-control bg-base text-white text-sm mb-2'
              rows={3}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setShowPolished(false);
              }}
              placeholder='Type your reply...'
            />

            {/* Polished preview */}
            {showPolished && polished && (
              <div className='p-3 rounded mb-2' style={{ background: 'rgba(3,255,0,0.05)', border: '1px solid rgba(3,255,0,0.2)' }}>
                <div className='d-flex align-items-center justify-content-between mb-1'>
                  <span className='text-xs fw-medium' style={{ color: '#03FF00' }}>
                    <Icon icon='mdi:auto-fix' className='me-1' style={{ fontSize: '14px' }} />
                    AI Polished
                  </span>
                  <button
                    className='btn btn-sm p-0 text-secondary-light text-xs'
                    onClick={() => {
                      setDraft(polished);
                      setShowPolished(false);
                    }}
                  >
                    Use as draft
                  </button>
                </div>
                <textarea
                  className='form-control bg-transparent text-white text-sm border-0 p-0'
                  rows={3}
                  value={polished}
                  onChange={(e) => setPolished(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>
            )}

            <div className='d-flex align-items-center gap-2'>
              <button
                className='btn btn-primary btn-sm'
                disabled={sending || (!draft.trim() && !polished.trim())}
                onClick={handleSend}
              >
                {sending && <span className='spinner-border spinner-border-sm me-1' />}
                <Icon icon='mdi:send' className='me-1' style={{ fontSize: '14px' }} />
                Send Reply
              </button>
              <button
                className='btn btn-outline-success btn-sm'
                disabled={polishing || !draft.trim()}
                onClick={handlePolish}
              >
                {polishing && <span className='spinner-border spinner-border-sm me-1' />}
                <Icon icon='mdi:auto-fix' className='me-1' style={{ fontSize: '14px' }} />
                Polish with AI
              </button>
              <button
                className='btn btn-outline-secondary btn-sm'
                onClick={handleSaveDraft}
                disabled={!draft.trim()}
              >
                Save Draft
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default QuestionReply;
