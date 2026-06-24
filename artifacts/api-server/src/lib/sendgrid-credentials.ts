// SendGrid credentials resolver.
//
// Uses the Replit SendGrid connector (blueprint id: sendgrid) when available,
// fetching the API key (and from address) from the Replit connector proxy at
// runtime. Falls back to the SENDGRID_API_KEY / SENDGRID_FROM_EMAIL environment
// variables when the connector is not bound, so email keeps working in any
// environment.
//
// WARNING: connector credentials can rotate — never cache the returned values.
// Always call these helpers fresh on each use.

export interface SendGridCredentials {
  apiKey: string;
  fromEmail?: string;
}

function getReplitToken(): string | null {
  if (process.env.REPL_IDENTITY) {
    return "repl " + process.env.REPL_IDENTITY;
  }
  if (process.env.WEB_REPL_RENEWAL) {
    return "depl " + process.env.WEB_REPL_RENEWAL;
  }
  return null;
}

/**
 * Try to resolve SendGrid credentials from the Replit connector proxy.
 * Returns null (never throws) when the connector is unavailable or unconfigured,
 * so callers can fall back to environment variables.
 */
async function getConnectorCredentials(): Promise<SendGridCredentials | null> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = getReplitToken();

  if (!hostname || !xReplitToken) {
    return null;
  }

  try {
    const response = await fetch(
      "https://" +
        hostname +
        "/api/v2/connection?include_secrets=true&connector_names=sendgrid",
      {
        headers: {
          Accept: "application/json",
          "X-Replit-Token": xReplitToken,
        },
      },
    );

    if (!response.ok) {
      return null;
    }

    const data: any = await response.json();
    const settings = data?.items?.[0]?.settings;
    const apiKey: string | undefined = settings?.api_key;
    const fromEmail: string | undefined = settings?.from_email;

    if (!apiKey) {
      return null;
    }

    return { apiKey, fromEmail };
  } catch {
    return null;
  }
}

/**
 * Resolve full SendGrid credentials (API key + optional from address).
 * Prefers the Replit connector, then falls back to environment variables.
 * Throws only when no credential source is available at all.
 */
export async function getSendGridCredentials(): Promise<SendGridCredentials> {
  const fromConnector = await getConnectorCredentials();
  if (fromConnector) {
    return {
      apiKey: fromConnector.apiKey,
      fromEmail: fromConnector.fromEmail || process.env.SENDGRID_FROM_EMAIL,
    };
  }

  const envKey = process.env.SENDGRID_API_KEY;
  if (envKey) {
    return { apiKey: envKey, fromEmail: process.env.SENDGRID_FROM_EMAIL };
  }

  throw new Error(
    "SendGrid is not configured: connect the SendGrid integration or set SENDGRID_API_KEY",
  );
}

/**
 * Convenience helper that returns just the API key.
 */
export async function getSendGridApiKey(): Promise<string> {
  const { apiKey } = await getSendGridCredentials();
  return apiKey;
}
