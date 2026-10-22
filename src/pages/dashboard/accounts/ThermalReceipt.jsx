import { formatGHS } from '../../../lib/billingLedger.js';

export default function ThermalReceipt({ payment, charges = [], patient, hospital, onClose }) {
  if (!payment) return null;
  const receiptCharges = charges.filter((charge) => payment.chargeIds.includes(charge.id));
  const gross = receiptCharges.reduce((sum, item) => sum + Number(item.chargeAmount || 0), 0);
  const insurer = receiptCharges.reduce((sum, item) => sum + Number(item.insurerAmount || 0), 0);
  return (
    <div className="billing-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="billing-receipt-modal" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
        <div className="billing-receipt-actions"><span>Receipt preview</span><button className="staff-secondary-button" type="button" onClick={onClose}>Close</button><button className="staff-primary-button" type="button" onClick={() => window.print()}>Print thermal receipt</button></div>
        <article className="thermal-receipt" id="thermal-receipt">
          <header>
            <h1 id="receipt-title">{hospital?.name || 'ASCEND HEALTHCARE CLINIC'}</h1>
            <p>{hospital?.address || 'Ghana'}</p>
            <p>{hospital?.phone || ''}</p>
            <p className="thermal-dots">--------------------------------</p>
          </header>
          <dl className="thermal-meta">
            <div><dt>Receipt</dt><dd>{payment.receiptNumber}</dd></div>
            <div><dt>Date</dt><dd>{new Date(payment.createdAt).toLocaleString('en-GB')}</dd></div>
            <div><dt>Cashier</dt><dd>{payment.cashierName}</dd></div>
            <div><dt>Patient</dt><dd>{patient?.full_name || payment.patientName || 'Patient'}</dd></div>
            <div><dt>MRN</dt><dd>{patient?.patient_number || patient?.mrn || 'Not recorded'}</dd></div>
            <div><dt>Scheme</dt><dd>{receiptCharges.some((charge) => charge.insurerAmount > 0) ? 'Insurance' : 'Private cash'}</dd></div>
          </dl>
          <p className="thermal-dots">--------------------------------</p>
          <table><thead><tr><th>Item</th><th>Qty</th><th>Amount</th></tr></thead><tbody>
            {receiptCharges.map((charge) => <tr key={charge.id}><td>{charge.description}</td><td>{charge.quantity}</td><td>{formatGHS(charge.chargeAmount)}</td></tr>)}
          </tbody></table>
          <p className="thermal-dots">--------------------------------</p>
          <dl className="thermal-totals">
            <div><dt>Gross charge</dt><dd>{formatGHS(gross)}</dd></div>
            <div><dt>Insurance coverage</dt><dd>-{formatGHS(insurer)}</dd></div>
            <div><dt>Patient payable</dt><dd>{formatGHS(gross - insurer)}</dd></div>
            <div><dt>Amount paid</dt><dd>{formatGHS(payment.amountPaid)}</dd></div>
            {payment.paymentMethod === 'Cash' && <div><dt>Cash tendered</dt><dd>{formatGHS(payment.cashTendered)}</dd></div>}
            {payment.paymentMethod === 'Cash' && <div><dt>Change returned</dt><dd>{formatGHS(payment.changeGiven)}</dd></div>}
            <div><dt>Payment method</dt><dd>{payment.paymentMethod}{payment.network ? ` / ${payment.network}` : ''}</dd></div>
          </dl>
          {payment.momoRef && <p>MoMo ref: {payment.momoRef}</p>}
          <footer><p>▦ {payment.receiptNumber}</p><p>Thank you for choosing AscendHMS</p><small>Valid official receipt. Computer generated.</small></footer>
        </article>
      </section>
    </div>
  );
}
