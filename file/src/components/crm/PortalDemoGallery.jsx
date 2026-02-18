const PortalDemoGallery = ({ demos }) => {
  return (
    <div className='card border-0 shadow-sm mb-4'>
      <div className='card-body'>
        <h6 className='fw-semibold mb-3' style={{ color: '#033457' }}>
          Demos & Previews
        </h6>
        <div className='row g-3'>
          {demos.map((demo) => (
            <div key={demo.id} className='col-sm-6'>
              <div className='card border h-100'>
                <div className='card-body p-3'>
                  <h6 className='fw-semibold small mb-1' style={{ color: '#033457' }}>
                    {demo.title}
                  </h6>
                  {demo.description && (
                    <p className='text-muted small mb-2'>{demo.description}</p>
                  )}
                  <a
                    href={demo.url}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='btn btn-sm fw-medium'
                    style={{
                      background: '#033457',
                      color: '#fff',
                      border: 'none',
                      fontSize: '13px',
                    }}
                  >
                    View Demo &rarr;
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PortalDemoGallery;
