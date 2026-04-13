import rbLogoSquareWordmark from '../assets/images/rb logo w wordmark 2000px transparent background.png';

// TODO FORA: privacy page will need contractor-aware content when multiple contractors use the platform
export default function PrivacyPolicy() {
  const heading = { fontSize: 16, fontWeight: 700, color: '#012854', margin: '24px 0 8px', fontFamily: 'Montserrat, sans-serif' };
  const body = { fontSize: 16, color: '#333333', lineHeight: 1.6, margin: '0 0 12px', fontFamily: 'Roboto, sans-serif' };
  const li = { ...body, margin: '4px 0' };

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
          Privacy Policy
        </h1>
        <p style={{ ...body, color: '#888888', margin: '0 0 32px' }}>Effective Date: April 13, 2026</p>

        {/* Section 1 */}
        <h2 style={heading}>1. Overview</h2>
        <p style={body}>
          Rooster Booster is a referral rewards platform operated by RoofMiles, LLC. The platform has two connected
          applications: the Referrer App (used by customers to track referrals and earn rewards) and the Contractor
          Admin Panel (used by roofing contractors to manage their referral program).
        </p>

        {/* Section 2 */}
        <h2 style={heading}>2. Information We Collect</h2>

        <h3 style={{ ...heading, fontSize: 15, margin: '16px 0 8px' }}>2a. Information You Provide (Referrer App)</h3>
        <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
          <li style={li}>Full name</li>
          <li style={li}>Email address</li>
          <li style={li}>4–6 digit PIN (stored as a one-way encrypted hash)</li>
          <li style={li}>Profile photo (optional)</li>
          <li style={li}>Cash out payment method details (Zelle, Venmo, PayPal, or mailing address — used only to process reward payments)</li>
          <li style={li}>Booking request information (name, phone, email, address, notes)</li>
        </ul>

        <h3 style={{ ...heading, fontSize: 15, margin: '16px 0 8px' }}>2b. Information Collected Automatically</h3>
        <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
          <li style={li}>Referral activity and pipeline status</li>
          <li style={li}>Login timestamps and session tokens (expire after 24 hours)</li>
          <li style={li}>Cash out request history</li>
          <li style={li}>Badge achievements and app interaction events</li>
        </ul>

        <h3 style={{ ...heading, fontSize: 15, margin: '16px 0 8px' }}>2c. Information From Third-Party Services</h3>
        <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
          <li style={li}>
            <strong>Jobber CRM</strong> — we read client name, the "Referred by" custom field, quote status, job status,
            and invoice payment status for clients created on or after the contractor's referral program start date.
            We do not write data back to Jobber.
          </li>
          <li style={li}>
            <strong>Google Places API</strong> — we retrieve public Google ratings for contractors.
            No personal user data is sent to Google.
          </li>
          <li style={li}>
            <strong>Stripe (future)</strong> — payment processing for ACH transfers. Stripe handles bank data directly
            under their own privacy policy.
          </li>
        </ul>

        {/* Section 3 */}
        <h2 style={heading}>3. How We Use Your Information</h2>
        <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
          <li style={li}>To operate the referral tracking system</li>
          <li style={li}>To process reward payouts</li>
          <li style={li}>To authenticate users and maintain secure sessions</li>
          <li style={li}>To send transactional emails (payout approvals, PIN resets, booking confirmations) from noreply@roofmiles.com</li>
          <li style={li}>To display contractor information and power leaderboard features</li>
          <li style={li}>To comply with legal obligations</li>
        </ul>
        <p style={body}>We do not sell your information or use it for advertising.</p>

        {/* Section 4 */}
        <h2 style={heading}>4. How We Share Your Information</h2>
        <p style={body}>We do not sell your personal information. We share data only with:</p>
        <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
          <li style={li}><strong>Your contractor</strong> — who can see your referral activity and payout history through their Admin Panel</li>
          <li style={li}><strong>Service providers</strong> — Resend (email), Railway (hosting), Vercel (frontend), Jobber (CRM), Stripe (payments, future)</li>
          <li style={li}><strong>Legal authorities</strong> — only when required by law</li>
        </ul>

        {/* Section 5 */}
        <h2 style={heading}>5. Data Security</h2>
        <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
          <li style={li}>PINs and passwords stored as bcrypt hashes — never readable</li>
          <li style={li}>CRM credentials stored encrypted</li>
          <li style={li}>All data transmission uses HTTPS/TLS encryption</li>
          <li style={li}>Session tokens are 64-character cryptographically random strings with 24-hour expiry</li>
          <li style={li}>Rate limiting protects all authentication endpoints</li>
        </ul>

        {/* Section 6 */}
        <h2 style={heading}>6. Children's Privacy</h2>
        <p style={body}>
          Rooster Booster is not directed to individuals under 18. We do not knowingly collect data from minors.
        </p>

        {/* Section 7 */}
        <h2 style={heading}>7. Your Rights</h2>
        <p style={body}>
          You may request access to, correction of, or deletion of your personal information by contacting us
          at <a href="mailto:hello@roofmiles.com" style={{ color: '#012854' }}>hello@roofmiles.com</a>.
        </p>

        {/* Section 8 */}
        <h2 style={heading}>8. Contact Us</h2>
        <p style={{ ...body, margin: '0 0 4px' }}><strong>RoofMiles, LLC — Rooster Booster</strong></p>
        <p style={{ ...body, margin: '0 0 4px' }}>Email: <a href="mailto:hello@roofmiles.com" style={{ color: '#012854' }}>hello@roofmiles.com</a></p>
        <p style={{ ...body, margin: '0 0 16px' }}>Website: roofmiles.com</p>

        <p style={{ ...body, margin: '0 0 4px' }}><strong>For Accent Roofing Service:</strong></p>
        <p style={{ ...body, margin: '0 0 4px' }}>Phone: 770-277-4869</p>
        <p style={{ ...body, margin: '0 0 0' }}>Email: <a href="mailto:contact@leaksmith.com" style={{ color: '#012854' }}>contact@leaksmith.com</a></p>

        {/* Section 9 */}
        <h2 style={heading}>9. Changes to This Policy</h2>
        <p style={body}>
          This policy was last updated April 13, 2026. Continued use of Rooster Booster after changes are posted
          constitutes acceptance of the updated policy.
        </p>
      </div>
    </div>
  );
}
