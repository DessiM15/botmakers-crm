'use client';

import { Icon } from '@iconify/react/dist/iconify.js';

const InvoicePrintButton = () => {
  return (
    <button
      className='btn btn-outline-secondary btn-sm d-flex align-items-center gap-1'
      onClick={() => window.print()}
      style={{ color: '#033457', borderColor: '#033457' }}
    >
      <Icon icon='mdi:printer' style={{ fontSize: '16px' }} />
      Print Invoice
    </button>
  );
};

export default InvoicePrintButton;
