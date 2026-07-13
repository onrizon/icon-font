import 'server-only';
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function init(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0];

  const projectId = process.env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL, and FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY.'
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

const adminApp = init();

const adminAuth = getAuth(adminApp);
const adminFirestore = getFirestore(adminApp);

export async function verifyIdTokenFromRequest(req: Request): Promise<{ uid: string }> {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!header || !header.startsWith('Bearer ')) {
    throw new HttpError(401, 'Missing Authorization bearer token');
  }
  const idToken = header.slice('Bearer '.length).trim();
  if (!idToken) {
    throw new HttpError(401, 'Empty bearer token');
  }
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    return { uid: decoded.uid };
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }
}

export async function assertProjectOwnership(projectId: string, uid: string): Promise<void> {
  const snap = await adminFirestore.collection('project').doc(projectId).get();
  if (!snap.exists) throw new HttpError(404, 'Project not found');
  const ownerUid = snap.get('ownerUid');
  if (ownerUid !== uid) throw new HttpError(403, 'Forbidden');
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
