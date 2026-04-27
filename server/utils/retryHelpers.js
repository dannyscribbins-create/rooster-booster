const resendShouldRetry = (error) => {
  const status = error?.response?.status || error?.statusCode;
  if (!status) return true;
  if (status >= 500) return true;
  return false;
};

const twilioShouldRetry = (error) => {
  const code = error?.code;
  if (!code) return true;
  if (String(code).startsWith('2')) return true;
  return false;
};

const jobberShouldRetry = (error) => {
  const status = error?.response?.status ?? error?.status;
  if (!status) return true;
  if (status === 401) return false;
  if (status === 429) return true;
  if (status >= 500) return true;
  return false;
};

module.exports = { resendShouldRetry, twilioShouldRetry, jobberShouldRetry };
