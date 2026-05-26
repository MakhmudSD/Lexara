import { LexaraLogo } from '../assets/LexaraLogo';

export default function PrivacyPage({ onHome }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f8f6f1', padding: '24px 20px 60px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <LexaraLogo height={36} onClick={onHome} style={{ cursor: 'pointer' }} />
        </div>
        <article style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 18, padding: 28, lineHeight: 1.75, color: '#2a2723' }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 30 }}>Privacy Policy</h1>
          <p style={{ margin: '0 0 22px', color: '#6b6560', fontSize: 13 }}>Last updated: May 26, 2026</p>
          <h2>1. What we collect</h2>
          <p>Account info: email, name, hashed password</p>
          <p>Usage data: queries made, documents uploaded (not content)</p>
          <p>Technical data: IP address, browser type, timestamps</p>
          <p>We do NOT sell your data. We do NOT use your documents to train AI.</p>
          <h2>2. How we use your data</h2>
          <p>To provide the Lexara service</p>
          <p>To send essential account emails (verification, password reset)</p>
          <p>To improve the product (aggregated, anonymized analytics only)</p>
          <h2>3. Data storage</h2>
          <p>Your documents are stored on secure servers. Conversation history is stored locally in your browser and optionally synced to our servers. Token usage data is stored to power your usage dashboard.</p>
          <h2>4. Your rights</h2>
          <p>You can request deletion of your account and all associated data at any time by emailing privacy@lexara.ai. We will process requests within 30 days in compliance with GDPR Article 17.</p>
          <h2>5. Cookies</h2>
          <p>We use only essential cookies for authentication. No tracking cookies. No third-party advertising cookies.</p>
          <h2>6. Third-party services</h2>
          <p>OpenAI: your document content is sent to OpenAI for AI processing. OpenAI&apos;s privacy policy applies: openai.com/privacy</p>
          <p>Stripe: payment processing (when applicable). Stripe&apos;s privacy policy applies: stripe.com/privacy</p>
          <h2>7. Contact</h2>
          <p>privacy@lexara.ai</p>
        </article>
      </div>
    </div>
  );
}
