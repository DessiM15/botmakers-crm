/**
 * Opens a new browser window with the branded proposal and triggers print dialog.
 * User can "Save as PDF" from the print dialog.
 */
export function printProposal({
  title,
  recipientName,
  scopeOfWork,
  deliverables,
  termsAndConditions,
  lineItems = [],
  pricingType,
  totalAmount,
}) {
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const fmt = (v) =>
    '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });

  const lineItemRows = lineItems
    .map(
      (item) => `
    <tr style="border-bottom: 1px solid #f0f0f0;">
      <td style="padding: 10px 14px; font-size: 14px; color: #333;">${item.description || ''}</td>
      ${pricingType === 'phased' ? `<td style="padding: 10px 14px; font-size: 14px; color: #666;">${item.phaseLabel || ''}</td>` : ''}
      <td style="padding: 10px 14px; font-size: 14px; color: #333; text-align: right;">${item.quantity || 1}</td>
      <td style="padding: 10px 14px; font-size: 14px; color: #333; text-align: right;">${fmt(item.unitPrice)}</td>
      <td style="padding: 10px 14px; font-size: 14px; color: #333; text-align: right; font-weight: 500;">${fmt(item.total)}</td>
    </tr>`
    )
    .join('');

  const phasedCol = pricingType === 'phased';

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>${title || 'Proposal'} — BotMakers</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter Tight', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #333; }
    @media print {
      body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      @page { margin: 0.4in; }
    }
    h3 { color: #033457; font-size: 16px; font-weight: 600; margin-bottom: 8px; }
    h4 { color: #033457; font-size: 14px; font-weight: 600; margin-bottom: 6px; }
    p { margin-bottom: 12px; line-height: 1.7; font-size: 15px; word-wrap: break-word; overflow-wrap: break-word; }
    ul, ol { padding-left: 20px; margin-bottom: 12px; }
    li { margin-bottom: 4px; line-height: 1.7; font-size: 15px; }
    strong { color: #222; }
    table { width: 100%; border-collapse: collapse; }
    .section-head { color: #033457; font-weight: 600; font-size: 17px; margin-bottom: 16px; padding-left: 14px; border-left: 3px solid #03FF00; }
    .content-block { word-wrap: break-word; overflow-wrap: break-word; }
  </style>
</head>
<body>
  <div style="max-width: 900px; margin: 0 auto;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #033457 0%, #022038 100%); padding: 40px 40px 32px; color: #fff;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
        <div>
          <div style="font-size: 18px; font-weight: 700; letter-spacing: 0.5px;">BotMakers Inc.</div>
          <div style="font-size: 13px; opacity: 0.7;">botmakers.ai &nbsp;·&nbsp; 832.790.5001</div>
        </div>
        <div style="font-size: 13px; opacity: 0.7; text-align: right;">${today}</div>
      </div>
      <div style="border-top: 1px solid rgba(255,255,255,0.15); margin: 0 0 24px;"></div>
      <h2 style="font-size: 28px; font-weight: 800; margin: 0 0 8px; line-height: 1.2; word-wrap: break-word;">${title || ''}</h2>
      ${recipientName ? `<div style="font-size: 15px; opacity: 0.8;">Prepared for: <strong style="opacity: 1;">${recipientName}</strong></div>` : ''}
    </div>

    <!-- Body -->
    <div style="background: #ffffff; padding: 36px 40px; color: #333;">
      <div style="margin-bottom: 32px;">
        <h5 class="section-head">Scope of Work</h5>
        <div class="content-block">${scopeOfWork || ''}</div>
      </div>
      <hr style="border: none; border-top: 1px solid #e9ecef; margin: 0 0 32px;" />

      <div style="margin-bottom: 32px;">
        <h5 class="section-head">Deliverables</h5>
        <div class="content-block">${deliverables || ''}</div>
      </div>
      <hr style="border: none; border-top: 1px solid #e9ecef; margin: 0 0 32px;" />

      <div style="margin-bottom: 32px;">
        <h5 class="section-head">Pricing</h5>
        <table>
          <thead>
            <tr style="background: #f8f9fa;">
              <th style="padding: 10px 14px; font-size: 13px; font-weight: 600; color: #033457; text-align: left; border-bottom: 2px solid #e9ecef;">Description</th>
              ${phasedCol ? '<th style="padding: 10px 14px; font-size: 13px; font-weight: 600; color: #033457; text-align: left; border-bottom: 2px solid #e9ecef;">Phase</th>' : ''}
              <th style="padding: 10px 14px; font-size: 13px; font-weight: 600; color: #033457; text-align: right; width: 80px; border-bottom: 2px solid #e9ecef;">Qty</th>
              <th style="padding: 10px 14px; font-size: 13px; font-weight: 600; color: #033457; text-align: right; width: 120px; border-bottom: 2px solid #e9ecef;">Unit Price</th>
              <th style="padding: 10px 14px; font-size: 13px; font-weight: 600; color: #033457; text-align: right; width: 120px; border-bottom: 2px solid #e9ecef;">Total</th>
            </tr>
          </thead>
          <tbody>${lineItemRows}</tbody>
          <tfoot>
            <tr style="background: #03FF00;">
              <td colspan="${phasedCol ? 4 : 3}" style="padding: 12px 14px; text-align: right; font-weight: 700; font-size: 15px; color: #033457;">Total</td>
              <td style="padding: 12px 14px; text-align: right; font-weight: 800; font-size: 18px; color: #033457;">${fmt(totalAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <hr style="border: none; border-top: 1px solid #e9ecef; margin: 0 0 32px;" />

      <div>
        <h5 class="section-head">Terms &amp; Conditions</h5>
        <div class="content-block">${termsAndConditions || ''}</div>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #f5f5f5; padding: 20px 40px; text-align: center; font-size: 13px; color: #888; border-top: 1px solid #e9ecef;">
      <div>&copy; ${new Date().getFullYear()} BotMakers Inc.</div>
      <div>832.790.5001 &nbsp;|&nbsp; botmakers.ai &nbsp;|&nbsp; Houston, TX</div>
    </div>
  </div>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    return false;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.print();
  };
  return true;
}
