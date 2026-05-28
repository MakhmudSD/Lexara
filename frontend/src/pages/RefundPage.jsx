import { useTranslation } from '../i18n/useTranslation';

export default function RefundPage({ onHome }) {
  const { t } = useTranslation();
  return (
    <div style={{ maxWidth: 680, margin: '60px auto', padding: '0 24px', fontFamily: 'Inter, system-ui, sans-serif', color: '#1a1814' }}>
      <button onClick={onHome} style={{ background: 'none', border: 'none', color: '#2356d8', cursor: 'pointer', marginBottom: 24, fontSize: 13 }}>← Back</button>
      <h1 style={{ fontSize: 28, fontWeight: 500, marginBottom: 8 }}>Refund Policy</h1>
      <p style={{ color: '#6b6860', fontSize: 13, marginBottom: 32 }}>Last updated: May 2026</p>
      <p>Lexara offers a <strong>7-day refund policy</strong> for new Pro and Business subscriptions.</p>
      <p>If you are not satisfied within 7 days of your first payment, contact <a href="mailto:support@lexara.app" style={{ color: '#2356d8' }}>support@lexara.app</a> for a full refund.</p>
      <p>Subscription renewals are non-refundable. Refunds are processed within 5–7 business days.</p>
      <p>Free plan users are not eligible for refunds as no payment is required.</p>
    </div>
  );
}
