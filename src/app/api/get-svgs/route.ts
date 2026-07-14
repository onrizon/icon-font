import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { r2, BUCKET } from '@/lib/r2';
import { verifyIdTokenFromRequest, assertProjectOwnership, HttpError } from '@/lib/firebase-admin';

const ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_IDS_PER_REQUEST = 50;
// Blobs are packed into the response until this budget is reached; overflow
// ids return in `pending` for the client to re-request. At least one blob is
// always included so the client's requeue loop is guaranteed progress. This
// keeps responses under serverless body caps (~4.5 MB) even with 4 MB blobs.
const RESPONSE_BYTE_BUDGET = 3 * 1024 * 1024;

/**
 * Batch-fetch icon SVG blobs from R2. Icon docs are metadata-only; this is how
 * the client hydrates artwork on project load.
 */
export async function POST(req: NextRequest) {
  try {
    const { uid } = await verifyIdTokenFromRequest(req);

    const body = await req.json();
    const projectId = body?.projectId;
    const iconIds = body?.iconIds;

    if (typeof projectId !== 'string' || !ID_PATTERN.test(projectId)) {
      return NextResponse.json({ error: 'Invalid projectId' }, { status: 400 });
    }
    if (
      !Array.isArray(iconIds) ||
      iconIds.length === 0 ||
      iconIds.length > MAX_IDS_PER_REQUEST ||
      iconIds.some(id => typeof id !== 'string' || !ID_PATTERN.test(id))
    ) {
      return NextResponse.json({ error: `iconIds must be 1-${MAX_IDS_PER_REQUEST} valid ids` }, { status: 400 });
    }

    await assertProjectOwnership(projectId, uid);

    const fetched = new Map<string, string | null>();
    await Promise.all(
      iconIds.map(async (iconId: string) => {
        try {
          const res = await r2.send(new GetObjectCommand({
            Bucket: BUCKET,
            Key: `icons/${projectId}/${iconId}.svg`,
          }));
          const text = await res.Body?.transformToString('utf-8');
          fetched.set(iconId, text || null);
        } catch {
          fetched.set(iconId, null);
        }
      })
    );

    // Pack in request order under the byte budget; overflow goes to `pending`.
    const svgs: Record<string, string> = {};
    const missing: string[] = [];
    const pending: string[] = [];
    let total = 0;
    for (const iconId of iconIds) {
      const text = fetched.get(iconId);
      if (text == null) {
        missing.push(iconId);
        continue;
      }
      const size = Buffer.byteLength(text);
      if (total > 0 && total + size > RESPONSE_BYTE_BUDGET) {
        pending.push(iconId);
        continue;
      }
      svgs[iconId] = text;
      total += size;
    }

    return NextResponse.json({ svgs, missing, pending });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('get-svgs error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
