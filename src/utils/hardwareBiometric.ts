function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array {
  const pad = '='.repeat((4 - (str.length % 4)) % 4);
  const b64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    out[i] = raw.charCodeAt(i);
  }
  return out;
}

export function isHardwareFingerprintSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    Boolean(navigator.credentials?.create) &&
    Boolean(navigator.credentials?.get)
  );
}

export async function captureHardwareFingerprintCredential(opts: {
  employeeId: string;
  employeeName: string;
  fingerLabel: string;
}): Promise<{ credentialId: string; publicKey: string; deviceLabel: string }> {
  if (!isHardwareFingerprintSupported()) {
    throw new Error(
      'Hardware WebAuthn fingerprint sensor is unavailable in this browser context. Use a ZKTeco K40 terminal (TCP 4370 / ADMS / LAN Bridge) or open the platform over HTTPS.'
    );
  }

  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  const userBytes = new TextEncoder().encode(`staff:${opts.employeeId}:${opts.fingerLabel}`);

  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: 'Seven Sunday Ethiopia Workforce & Biometrics',
        id: window.location.hostname,
      },
      user: {
        id: userBytes,
        name: `${opts.employeeId} · ${opts.fingerLabel}`,
        displayName: `${opts.employeeName} (${opts.fingerLabel})`,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    },
  })) as PublicKeyCredential | null;

  if (!cred) {
    throw new Error('Fingerprint enrollment was cancelled or timed out on the hardware sensor.');
  }

  const resp = cred.response as AuthenticatorAttestationResponse;
  const rawPub = typeof resp.getPublicKey === 'function' ? resp.getPublicKey() : null;
  const publicKey = rawPub
    ? toBase64Url(rawPub)
    : toBase64Url(resp.attestationObject || cred.rawId);

  const ua = navigator.userAgent || '';
  const platformName = ua.includes('Android')
    ? 'Android Fingerprint Sensor'
    : ua.includes('Mac')
    ? 'Touch ID Fingerprint Reader'
    : ua.includes('Windows')
    ? 'Windows Hello / USB Fingerprint Reader'
    : 'USB / Hardware Fingerprint Sensor';

  return {
    credentialId: cred.id || toBase64Url(cred.rawId),
    publicKey,
    deviceLabel: platformName,
  };
}

export async function verifyHardwareFingerprintCredential(opts?: {
  allowCredentialIds?: string[];
}): Promise<{ credentialId: string; authenticatorData: string; signature: string }> {
  if (!isHardwareFingerprintSupported()) {
    throw new Error(
      'Hardware WebAuthn fingerprint sensor is unavailable in this browser context. Use your ZKTeco K40 terminal for live finger punches.'
    );
  }

  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  const allowCredentials: PublicKeyCredentialDescriptor[] | undefined =
    opts?.allowCredentialIds && opts.allowCredentialIds.length > 0
      ? opts.allowCredentialIds.map((id) => ({
          type: 'public-key',
          id: fromBase64Url(id) as unknown as BufferSource,
        }))
      : undefined;

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge,
      timeout: 60000,
      userVerification: 'required',
      ...(allowCredentials ? { allowCredentials } : {}),
    },
  })) as PublicKeyCredential | null;

  if (!assertion) {
    throw new Error('Hardware fingerprint verification was cancelled.');
  }

  const resp = assertion.response as AuthenticatorAssertionResponse;
  return {
    credentialId: assertion.id || toBase64Url(assertion.rawId),
    authenticatorData: toBase64Url(resp.authenticatorData),
    signature: toBase64Url(resp.signature),
  };
}
