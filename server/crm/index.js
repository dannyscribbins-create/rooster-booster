const jobber = require('./jobber');

function getCRMAdapter(contractorId) {
  // Currently always returns Jobber — expand when additional CRM adapters are built
  return jobber;
}

module.exports = { getCRMAdapter };
