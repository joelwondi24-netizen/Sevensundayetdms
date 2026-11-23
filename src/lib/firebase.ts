import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  type Auth,
  type UserCredential,
} from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
  type Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

/**
 * Project domain whitelist for Firebase Auth & Render production deployment.
 * Entries may be exact hostnames (e.g. "sevensunday-ethiopia.onrender.com")
 * or wildcard domain suffixes prefixed with "." (e.g. ".onrender.com").
 */
const ENV_RENDER_DOMAIN = String(import.meta.env.VITE_RENDER_DOMAIN || '')
  .trim()
  .replace(/^https?:\/\//i, '')
  .split('/')[0]
  .split(':')[0]
  .toLowerCase();

const ENV_CUSTOM_AUTH_DOMAIN = String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '')
  .trim()
  .replace(/^https?:\/\//i, '')
  .split('/')[0]
  .split(':')[0]
  .toLowerCase();

const ENV_APP_DOMAIN = String(import.meta.env.VITE_APP_DOMAIN || '')
  .trim()
  .replace(/^https?:\/\//i, '')
  .split('/')[0]
  .split(':')[0]
  .toLowerCase();

export const FIREBASE_DOMAIN_WHITELIST: readonly string[] = Array.from(
  new Set(
    [
      firebaseConfig.authDomain.toLowerCase(),
      `${firebaseConfig.projectId}.firebaseapp.com`.toLowerCase(),
      `${firebaseConfig.projectId}.web.app`.toLowerCase(),
      'localhost',
      '127.0.0.1',
      '.run.app',
      '.onrender.com',
      'sevensundayethiopia.onrender.com',
      'sevensundayethiopia.com',
      '.sevensundayethiopia.com',
      ENV_RENDER_DOMAIN,
      ENV_CUSTOM_AUTH_DOMAIN,
      ENV_APP_DOMAIN,
    ].filter(Boolean)
  )
);

export function normalizeHostname(input: string): string {
  return String(input || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .split(':')[0]
    .toLowerCase();
}

export function isDomainWhitelisted(hostOrUrl: string): boolean {
  const host = normalizeHostname(hostOrUrl);
  if (!host) return false;
  return FIREBASE_DOMAIN_WHITELIST.some((entry) => {
    if (entry.startsWith('.')) {
      return host.endsWith(entry) && host.length > entry.length;
    }
    return host === entry;
  });
}

/**
 * Resolves the Firebase authDomain against the project domain whitelist.
 * Defaults to the provisioned Firebase authDomain (`<projectId>.firebaseapp.com`),
 * or uses `VITE_FIREBASE_AUTH_DOMAIN` if it is explicitly configured and whitelisted.
 */
export function resolveAuthorizedAuthDomain(): string {
  const provisionedAuthDomain = normalizeHostname(firebaseConfig.authDomain);

  if (ENV_CUSTOM_AUTH_DOMAIN && isDomainWhitelisted(ENV_CUSTOM_AUTH_DOMAIN)) {
    return ENV_CUSTOM_AUTH_DOMAIN;
  }

  if (
    ENV_RENDER_DOMAIN &&
    import.meta.env.VITE_FIREBASE_USE_CUSTOM_AUTH_DOMAIN === 'true' &&
    isDomainWhitelisted(ENV_RENDER_DOMAIN)
  ) {
    return ENV_RENDER_DOMAIN;
  }

  return isDomainWhitelisted(provisionedAuthDomain)
    ? provisionedAuthDomain
    : `${firebaseConfig.projectId}.firebaseapp.com`;
}

export const resolvedFirebaseConfig = {
  ...firebaseConfig,
  authDomain: resolveAuthorizedAuthDomain(),
};

export const firebaseApp: FirebaseApp = getApps().length
  ? getApp()
  : initializeApp(resolvedFirebaseConfig);

export const db: Firestore = getFirestore(
  firebaseApp,
  firebaseConfig.firestoreDatabaseId
);

export const auth: Auth = getAuth(firebaseApp);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export function getFirebaseAuthorizedOriginStatus(): {
  currentOriginHost: string;
  originWhitelisted: boolean;
  configuredAuthDomain: string;
  renderDomain: string | null;
  projectId: string;
  consoleAuthSettingsUrl: string;
} {
  const currentOriginHost =
    typeof window !== 'undefined' ? normalizeHostname(window.location.hostname) : '';
  return {
    currentOriginHost,
    originWhitelisted: currentOriginHost ? isDomainWhitelisted(currentOriginHost) : true,
    configuredAuthDomain: resolvedFirebaseConfig.authDomain,
    renderDomain: ENV_RENDER_DOMAIN || null,
    projectId: firebaseConfig.projectId,
    consoleAuthSettingsUrl: `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`,
  };
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let connectionTested = false;

export async function testConnection(): Promise<void> {
  if (connectionTested) return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

export async function signInWithCorporateGooglePopup(): Promise<{
  credential: UserCredential;
  firebaseIdToken: string;
  googleOAuthIdToken: string | null;
  email: string | null;
}> {
  const originStatus = getFirebaseAuthorizedOriginStatus();
  if (originStatus.currentOriginHost && !originStatus.originWhitelisted) {
    throw new Error(
      `Host "${originStatus.currentOriginHost}" is not in the Firebase authorized domain whitelist. Add it to VITE_RENDER_DOMAIN and Firebase Console Authorized domains.`
    );
  }
  const credential = await signInWithPopup(auth, googleProvider);
  const firebaseIdToken = await credential.user.getIdToken();
  const oauthCred = GoogleAuthProvider.credentialFromResult(credential);
  return {
    credential,
    firebaseIdToken,
    googleOAuthIdToken: oauthCred?.idToken || null,
    email: credential.user.email,
  };
}

export { firebaseConfig };
