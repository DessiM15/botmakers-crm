'use client';

import { useState } from 'react';

const statusIcon = (status) => {
  if (status === 'completed') {
    return (
      <span
        className='d-inline-flex align-items-center justify-content-center rounded-circle'
        style={{ width: 22, height: 22, background: '#03FF00', flexShrink: 0 }}
      >
        <svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='#033457' strokeWidth='3' strokeLinecap='round' strokeLinejoin='round'>
          <polyline points='20 6 9 17 4 12' />
        </svg>
      </span>
    );
  }
  if (status === 'in_progress') {
    return (
      <span
        className='d-inline-flex align-items-center justify-content-center rounded-circle'
        style={{ width: 22, height: 22, background: '#033457', flexShrink: 0 }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#03FF00', display: 'block' }} />
      </span>
    );
  }
  // pending or overdue
  return (
    <span
      className='d-inline-flex align-items-center justify-content-center rounded-circle'
      style={{
        width: 22,
        height: 22,
        border: `2px solid ${status === 'overdue' ? '#dc3545' : '#dee2e6'}`,
        flexShrink: 0,
      }}
    />
  );
};

const PortalMilestones = ({ phases }) => {
  const [openPhases, setOpenPhases] = useState(
    // Open phases that have incomplete milestones
    phases
      .filter((p) => p.milestones.some((m) => m.status !== 'completed'))
      .map((p) => p.id)
  );

  const togglePhase = (phaseId) => {
    setOpenPhases((prev) =>
      prev.includes(phaseId)
        ? prev.filter((id) => id !== phaseId)
        : [...prev, phaseId]
    );
  };

  return (
    <div className='card border-0 shadow-sm mb-4'>
      <div className='card-body'>
        <h6 className='fw-semibold mb-3' style={{ color: '#033457' }}>
          Project Milestones
        </h6>
        <div className='d-flex flex-column'>
          {phases.map((phase) => {
            const isOpen = openPhases.includes(phase.id);
            const completed = phase.milestones.filter((m) => m.status === 'completed').length;
            const total = phase.milestones.length;
            const allDone = completed === total && total > 0;

            return (
              <div key={phase.id} className='mb-2'>
                <button
                  type='button'
                  className='btn btn-sm w-100 d-flex align-items-center justify-content-between p-2 rounded'
                  style={{
                    background: allDone ? '#03FF0010' : '#f8f9fa',
                    border: 'none',
                    color: '#033457',
                  }}
                  onClick={() => togglePhase(phase.id)}
                >
                  <span className='fw-semibold small'>
                    {allDone && (
                      <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='#198754' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round' className='me-1' style={{ marginTop: '-2px' }}>
                        <polyline points='20 6 9 17 4 12' />
                      </svg>
                    )}
                    {phase.name}
                  </span>
                  <span className='d-flex align-items-center gap-2'>
                    <span className='text-muted small'>
                      {completed}/{total}
                    </span>
                    <svg
                      width='14'
                      height='14'
                      viewBox='0 0 24 24'
                      fill='none'
                      stroke='currentColor'
                      strokeWidth='2'
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      style={{
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s',
                      }}
                    >
                      <polyline points='6 9 12 15 18 9' />
                    </svg>
                  </span>
                </button>

                {isOpen && (
                  <div className='ps-2 pt-2'>
                    {phase.milestones.map((m) => (
                      <div
                        key={m.id}
                        className='d-flex align-items-start gap-2 mb-2'
                      >
                        {statusIcon(m.status)}
                        <div>
                          <span
                            className='small'
                            style={{
                              color: m.status === 'completed' ? '#6c757d' : '#033457',
                              textDecoration: m.status === 'completed' ? 'line-through' : 'none',
                            }}
                          >
                            {m.title}
                          </span>
                          {m.status === 'overdue' && (
                            <span className='badge bg-danger ms-2' style={{ fontSize: '10px' }}>
                              Overdue
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PortalMilestones;
