/**
 * config/whatsapp.js — Server-side Meta WhatsApp Business Cloud API Configuration (Day 24 Task 48)
 *
 * All credentials are read exclusively from environment variables on the backend.
 * Never expose accessToken, appSecret, or verifyToken to client responses.
 */

const PLACEHOLDER_PREFIXES = ['your_', 'replace_', 'example_', 'changeme'];

function isPlaceholder(val) {
  if (!val || typeof val !== 'string') return true;
  const trimmed = val.trim().toLowerCase();
  if (!trimmed) return true;
  return PLACEHOLDER_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

/**
 * Read WhatsApp Business Cloud API configuration from environment variables.
 *
 * @param {NodeJS.ProcessEnv} [env=process.env]
 */
export function getWhatsAppConfig(env = process.env) {
  return {
    apiVersion: (env.WHATSAPP_API_VERSION || 'v21.0').trim(),
    phoneNumberId: (env.WHATSAPP_PHONE_NUMBER_ID || '').trim(),
    businessAccountId: (env.WHATSAPP_BUSINESS_ACCOUNT_ID || '').trim(),
    accessToken: (env.WHATSAPP_ACCESS_TOKEN || '').trim(),
    appSecret: (env.WHATSAPP_APP_SECRET || '').trim(),
    verifyToken: (env.WHATSAPP_VERIFY_TOKEN || env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '').trim(),
    mockDispatch: env.WHATSAPP_MOCK_DISPATCH === 'true',
  };
}

/**
 * Check whether usable non-placeholder credentials exist for live Cloud API calls.
 */
export function isWhatsAppConfigured(config = getWhatsAppConfig()) {
  return !isPlaceholder(config.phoneNumberId) && !isPlaceholder(config.accessToken);
}

/**
 * Check whether WhatsApp should operate in simulated mock dispatch mode.
 */
export function isWhatsAppMockMode(config = getWhatsAppConfig(), env = process.env) {
  if (config.mockDispatch || env.TEST_MODE === 'true') {
    return true;
  }
  return !isWhatsAppConfigured(config);
}

/**
 * Build the Meta Graph API endpoint for sending WhatsApp messages.
 */
export function getGraphApiMessagesUrl(config = getWhatsAppConfig()) {
  const version = config.apiVersion || 'v21.0';
  return `https://graph.facebook.com/${version}/${config.phoneNumberId}/messages`;
}

/**
 * Produce a safe, secret-free diagnostic status object for staff dashboards and health checks.
 */
export function getSanitizedWhatsAppStatus(config = getWhatsAppConfig(), env = process.env) {
  const configured = isWhatsAppConfigured(config);
  const mockMode = isWhatsAppMockMode(config, env);

  return {
    apiVersion: config.apiVersion,
    configured,
    mockMode,
    mode: mockMode ? 'sandbox_mock' : 'live_cloud_api',
    hasPhoneNumberId: !isPlaceholder(config.phoneNumberId),
    hasBusinessAccountId: !isPlaceholder(config.businessAccountId),
    hasAccessToken: !isPlaceholder(config.accessToken),
    hasAppSecret: !isPlaceholder(config.appSecret),
    hasVerifyToken: !isPlaceholder(config.verifyToken),
  };
}
