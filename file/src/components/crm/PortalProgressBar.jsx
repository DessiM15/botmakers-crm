const PortalProgressBar = ({ progress, completed, total }) => {
  return (
    <div className='card border-0 shadow-sm mb-4'>
      <div className='card-body'>
        <div className='d-flex align-items-end justify-content-between mb-2'>
          <span className='small fw-medium' style={{ color: '#033457' }}>
            Overall Progress
          </span>
          <span
            className='fw-bold'
            style={{
              fontSize: '28px',
              color: progress === 100 ? '#198754' : '#03FF00',
              lineHeight: 1,
            }}
          >
            {progress}%
          </span>
        </div>
        <div
          className='progress mb-2'
          style={{ height: '12px', background: '#e9ecef', borderRadius: '6px' }}
        >
          <div
            className='progress-bar'
            style={{
              width: `${progress}%`,
              background: progress === 100
                ? 'linear-gradient(90deg, #198754, #20c997)'
                : 'linear-gradient(90deg, #033457, #03FF00)',
              transition: 'width 1s ease',
              borderRadius: '6px',
            }}
          />
        </div>
        <p className='text-muted small mb-0'>
          {completed} of {total} milestones complete
        </p>
      </div>
    </div>
  );
};

export default PortalProgressBar;
