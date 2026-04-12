// AccuLynx CRM adapter
// MVP stub — implement when AccuLynx API access is obtained

// fetchPipelineForReferrer(referrerName, contractorId, config)
// config = { credential, referrerFieldName, stageMap }
async function fetchPipelineForReferrer(referrerName, contractorId, config) {
  throw new Error('AccuLynx adapter not yet implemented');
}

// testConnection(credential) — verify API key or OAuth token is valid
async function testConnection(credential) {
  return { success: false, message: 'AccuLynx adapter not yet implemented' };
}

module.exports = { fetchPipelineForReferrer, testConnection };
