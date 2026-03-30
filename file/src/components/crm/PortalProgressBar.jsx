const PortalProgressBar = ({ progress = 0, completed = 0, total = 0 }) => {
  const pct = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div className='card border-0 shadow-sm mb-4'>
      <div className='card-body'>
        <div className='d-flex justify-content-between align-items-center mb-2'>
          <h6 className='fw-semibold mb-0' style={{ color: '#033457' }}>
            Project Progress
          </h6>
          <span className='text-muted small'>
            {completed} of {total} milestones complete
          </span>
        </div>
        <div
          className='progress'
          style={{ height: '10px', borderRadius: '5px', backgroundColor: '#e9ecef' }}
        >
          <div
            className='progress-bar'
            role='progressbar'
            style={{
              width: `${pct}%`,
              backgroundColor: pct === 100 ? '#03FF00' : '#033457',
              borderRadius: '5px',
              transition: 'width 0.4s ease',
            }}
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <div className='text-end mt-1'>
          <span className='fw-bold small' style={{ color: '#033457' }}>
            {pct}%
          </span>
        </div>
      </div>
    </div>
  );
};

export default PortalProgressBar;
