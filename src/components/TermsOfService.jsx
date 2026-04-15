import rbLogoSquareWordmark from '../assets/images/rb logo w wordmark 2000px transparent background.png';

export default function TermsOfService() {
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
          Rooster Booster Referral Program — Terms of Service
        </h1>
        <p style={{ ...body, color: '#888888', margin: '0 0 32px' }}>Effective Date: April 15, 2026</p>

        {/* Section 1 */}
        <h2 style={heading}>Section 1 — Eligibility</h2>
        <p style={body}>
          You must be 18 years or older and a legal US resident to participate. Employees and immediate family
          members of Accent Roofing Service are not eligible.
        </p>

        {/* Section 2 */}
        <h2 style={heading}>Section 2 — How the Program Works</h2>
        <p style={body}>
          You earn rewards by referring new clients to Accent Roofing Service. A referral is credited to you
          when a client you referred completes a qualifying paid job. Only one referral credit is issued per
          referred client, ever. Referrals are tracked through your unique invite link or QR code.
        </p>

        {/* Section 3 */}
        <h2 style={heading}>Section 3 — Rewards and Payouts</h2>
        <p style={body}>
          Reward amounts are determined by a tiered boost schedule based on your cumulative number of paid
          referrals. We reserve the right to modify the boost schedule at any time with notice. Rewards have
          no cash value until a cashout request is approved. The minimum cashout amount is $20. Payouts are
          processed via ACH bank transfer through Stripe. Processing times vary and are not guaranteed.
        </p>

        {/* Section 4 */}
        <h2 style={heading}>Section 4 — Final Payout on Account Deletion</h2>
        <p style={body}>
          If you delete your account and have an outstanding balance, a final cashout request will be
          automatically submitted on your behalf at the time of deletion. This final payout request is exempt
          from the $20 minimum threshold. Your account will be deactivated immediately and permanently deleted
          after 30 days.
        </p>

        {/* Section 5 */}
        <h2 style={heading}>Section 5 — Account Deletion</h2>
        <p style={body}>
          You may delete your account at any time from the Manage Account section of the app. Deletion is a
          soft delete — your account is deactivated immediately and all data is permanently purged after 30
          days. This action cannot be undone after the 30-day window.
        </p>

        {/* Section 6 */}
        <h2 style={heading}>Section 6 — Prohibited Conduct</h2>
        <p style={body}>
          You may not create fake referrals, refer yourself, manipulate the referral system, create multiple
          accounts, or use automated tools to generate referrals. Violation of these rules will result in
          immediate account termination and forfeiture of any pending balance.
        </p>

        {/* Section 7 */}
        <h2 style={heading}>Section 7 — Program Changes and Termination</h2>
        <p style={body}>
          We reserve the right to modify, suspend, or terminate the Program at any time. If the Program is
          terminated, any approved and pending cashout requests will be honored. Unearned or unapproved
          balances may be forfeited.
        </p>

        {/* Section 8 */}
        <h2 style={heading}>Section 8 — Privacy</h2>
        <p style={body}>
          Your use of this app is also governed by our Privacy Policy, available at{' '}
          <a href="/privacy" style={{ color: '#012854' }}>/privacy</a>.
        </p>

        {/* Section 9 */}
        <h2 style={heading}>Section 9 — Limitation of Liability</h2>
        <p style={body}>
          To the maximum extent permitted by law, Accent Roofing Service shall not be liable for any
          indirect, incidental, or consequential damages arising from your participation in the Program.
        </p>

        {/* Section 10 */}
        <h2 style={heading}>Section 10 — Governing Law</h2>
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
