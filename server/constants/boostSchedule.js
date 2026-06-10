// Canonical backend boost schedule. Frontend mirror: src/constants/boostSchedule.js
// — any change here MUST be mirrored there.
// Bonus schedule: $500 base + boost per tier. Index = count of bonus-eligible paid
// referrals; values beyond the last tier clamp to the final entry ("7th & beyond").
const boostSchedule = [0, 100, 200, 250, 300, 350, 400];

module.exports = { boostSchedule };
