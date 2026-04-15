import rbLogoSquareWordmark from '../assets/images/rb logo w wordmark 2000px transparent background.png';

export default function ContractorTerms() {
  const heading = { fontSize: 16, fontWeight: 700, color: '#012854', margin: '24px 0 8px', fontFamily: 'Montserrat, sans-serif' };
  const body = { fontSize: 16, color: '#333333', lineHeight: 1.6, margin: '0 0 12px', fontFamily: 'Roboto, sans-serif' };

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF', fontFamily: 'Roboto, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 24px 48px' }}>

        {/* Back link */}
        <button
          onClick={() => window.history.back()}
          style={{
            background: 'none', border: 'none', padding: '0 0 24px', margin: 0,
            cursor: 'pointer', color: '#012854', fontSize: 14, fontWeight: 600,
            fontFamily: 'Roboto, sans-serif', display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          ← Back
        </button>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img
            src={rbLogoSquareWordmark}
            alt="Rooster Booster"
            style={{ width: 180, height: 'auto' }}
          />
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: 28, fontWeight: 700, color: '#012854',
          fontFamily: 'Montserrat, sans-serif', margin: '0 0 8px',
        }}>
          Rooster Booster / FORA Platform — Contractor Terms of Service
        </h1>
        <p style={{ ...body, color: '#888888', margin: '0 0 32px' }}>Effective Date: April 15, 2026</p>

        {/* Section 1 */}
        <h2 style={heading}>Section 1 — Platform Description</h2>
        <p style={body}>
          The Platform is a referral rewards management tool that integrates with your CRM (currently Jobber)
          to track referred clients through your sales pipeline and automate referral reward payouts to your
          referrers. The Platform is read-only against your CRM — it never modifies your CRM data.
        </p>

        {/* Section 2 */}
        <h2 style={heading}>Section 2 — Subscription and Billing</h2>
        <p style={body}>
          Platform access is billed monthly or annually based on the tier you select (Starter, Growth, or
          Pro). Subscription fees are charged at the start of each billing period and are non-refundable.
          Overage fees for payouts and SMS beyond your tier's included amounts are billed at your tier's
          overage rate. Annual subscriptions receive two months free.
        </p>

        {/* Section 3 */}
        <h2 style={heading}>Section 3 — Payout Processing</h2>
        <p style={body}>
          Referrer payouts are processed through Stripe Connect. You are required to connect your own Stripe
          account to the Platform. The Platform orchestrates payouts on your behalf but does not hold funds.
          You are responsible for ensuring sufficient funds are available in your connected Stripe account.
          Stripe's terms of service apply to all payment processing.
        </p>

        {/* Section 4 */}
        <h2 style={heading}>Section 4 — CRM Integration</h2>
        <p style={body}>
          The Platform connects to your Jobber account via OAuth 2.0. The connection is read-only. You may
          disconnect at any time from within Jobber or the Platform. Disconnecting your CRM will suspend
          pipeline sync and may affect referrer-facing data in the app.
        </p>

        {/* Section 5 */}
        <h2 style={heading}>Section 5 — SMS Messaging</h2>
        <p style={body}>
          SMS notifications to referrers are sent on your behalf using a shared or dedicated phone number
          provisioned through Twilio. SMS volume is subject to your tier's included monthly allowance.
          Overages are billed at your tier's SMS overage rate. You are responsible for ensuring your referral
          program complies with applicable SMS marketing laws including the TCPA.
        </p>

        {/* Section 6 */}
        <h2 style={heading}>Section 6 — Data and Privacy</h2>
        <p style={body}>
          Client data pulled from your CRM is used solely to track referral attribution and pipeline status.
          We do not sell or share your client data with third parties. You retain ownership of all your CRM
          data. Our Privacy Policy is available at{' '}
          <a href="/privacy" style={{ color: '#012854' }}>/privacy</a>.
        </p>

        {/* Section 7 */}
        <h2 style={heading}>Section 7 — Acceptable Use</h2>
        <p style={body}>
          You may not use the Platform to send spam, harass referrers, or engage in any fraudulent referral
          activity. You are responsible for the conduct of your referral program and the referrers you invite.
        </p>

        {/* Section 8 */}
        <h2 style={heading}>Section 8 — Uptime and Support</h2>
        <p style={body}>
          We target 99% uptime but do not guarantee uninterrupted service. Planned maintenance will be
          communicated in advance where possible. Support is available via{' '}
          <a href="mailto:hello@roofmiles.com" style={{ color: '#012854' }}>hello@roofmiles.com</a>.
        </p>

        {/* Section 9 */}
        <h2 style={heading}>Section 9 — Termination</h2>
        <p style={body}>
          Either party may terminate the subscription at any time. Upon termination, your referrers will lose
          access to the app. Any pending approved cashout requests at the time of termination will be honored.
          Data will be retained for 30 days post-termination and then permanently purged.
        </p>

        {/* Section 10 */}
        <h2 style={heading}>Section 10 — Limitation of Liability</h2>
        <p style={body}>
          To the maximum extent permitted by law, RoofMiles / Accent Roofing Service shall not be liable for
          any indirect, incidental, or consequential damages arising from your use of the Platform, including
          but not limited to lost revenue, CRM data issues, or payout processing delays.
        </p>

        {/* Section 11 */}
        <h2 style={heading}>Section 11 — Governing Law</h2>
        <p style={body}>
          These Terms are governed by the laws of the State of Georgia.
        </p>

        <p style={{ ...body, margin: '24px 0 0' }}>
          Contact: <a href="mailto:hello@roofmiles.com" style={{ color: '#012854' }}>hello@roofmiles.com</a>
        </p>

      </div>
    </div>
  );
}
