'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitQuestion } from '@/lib/actions/portal';

const PortalQuestionForm = ({ projectId, questions }) => {
  const router = useRouter();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (text.trim().length < 10) {
      setError('Question must be at least 10 characters.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess(false);

    const result = await submitQuestion(projectId, text);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setText('');
      router.refresh();
      setTimeout(() => setSuccess(false), 3000);
    }
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
    <div className='card border-0 shadow-sm mb-4'>
      <div className='card-body'>
        <h6 className='fw-semibold mb-3' style={{ color: '#033457' }}>
          Questions & Answers
        </h6>

        {/* Submit form */}
        <form onSubmit={handleSubmit} className='mb-4'>
          <textarea
            className='form-control mb-2'
            rows={3}
            placeholder='Ask a question about your project (min 10 characters)...'
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={loading}
            style={{ resize: 'vertical' }}
          />
          {error && (
            <div className='text-danger small mb-2'>{error}</div>
          )}
          {success && (
            <div className='text-success small mb-2'>
              Question submitted! Our team will respond soon.
            </div>
          )}
          <button
            type='submit'
            className='btn btn-sm fw-medium'
            disabled={loading || text.trim().length < 10}
            style={{
              background: '#033457',
              color: '#fff',
              border: 'none',
            }}
          >
            {loading ? (
              <span className='spinner-border spinner-border-sm me-2' role='status' />
            ) : null}
            Submit Question
          </button>
        </form>

        {/* Q&A History */}
        {questions.length === 0 ? (
          <p className='text-muted small text-center mb-0'>
            No questions yet. Ask something above!
          </p>
        ) : (
          <div className='d-flex flex-column gap-3'>
            {questions.map((q) => (
              <div
                key={q.id}
                className='p-3 rounded'
                style={{ background: '#f8f9fa' }}
              >
                <div className='d-flex align-items-start justify-content-between mb-2'>
                  <span className='small fw-semibold' style={{ color: '#033457' }}>
                    You asked:
                  </span>
                  <span className='text-muted' style={{ fontSize: '11px' }}>
                    {formatDate(q.createdAt)}
                  </span>
                </div>
                <p className='small mb-2' style={{ color: '#333' }}>
                  {q.questionText}
                </p>

                {q.status === 'replied' && q.replyText ? (
                  <div
                    className='p-2 rounded mt-2'
                    style={{ background: '#033457' + '0a', borderLeft: '3px solid #03FF00' }}
                  >
                    <div className='d-flex align-items-center gap-1 mb-1'>
                      <span className='small fw-semibold' style={{ color: '#033457' }}>
                        {q.repliedByName || 'Team'}
                      </span>
                      {q.repliedAt && (
                        <span className='text-muted' style={{ fontSize: '11px' }}>
                          &bull; {formatDate(q.repliedAt)}
                        </span>
                      )}
                    </div>
                    <p className='small mb-0' style={{ color: '#333' }}>
                      {q.replyText}
                    </p>
                  </div>
                ) : (
                  <span
                    className='badge'
                    style={{
                      background: '#ffc107' + '22',
                      color: '#856404',
                      fontSize: '11px',
                    }}
                  >
                    Awaiting reply
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PortalQuestionForm;
