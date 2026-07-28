import { google } from "googleapis";
import * as fs from "fs";
import * as path from "path";

const SCOPES = [
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/cloudplatformprojects",
  "https://www.googleapis.com/auth/analytics",
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/analytics.edit",
];

/**
 * Returns a GoogleAuth instance using the GoogleAuth class bundled *inside*
 * the googleapis package. This avoids the duplicate google-auth-library
 * version type mismatch when passing auth to google.analyticsadmin(), etc.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAuth(): any {
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyFile) {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS environment variable is not set.\n" +
        "Set it to the absolute path of your service account JSON key file.\n" +
        "Example: export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json"
    );
  }

  const resolved = path.resolve(keyFile);
  if (!fs.existsSync(resolved)) {
    throw new Error(
      `Service account key file not found: ${resolved}\n` +
        "Please check that GOOGLE_APPLICATION_CREDENTIALS points to a valid file."
    );
  }

  // Use googleapis' own bundled GoogleAuth — avoids the dual-package type conflict.
  return new google.auth.GoogleAuth({
    keyFile: resolved,
    scopes: SCOPES,
  });
}

/**
 * Returns a plain Bearer token string for APIs that only accept string auth.
 * NOT used for analyticsadmin/analyticsdata — those use getAuth() directly.
 */
export async function getAccessToken(): Promise<string> {
  const auth = getAuth();
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error("Failed to obtain access token.");
  return token.token;
}
