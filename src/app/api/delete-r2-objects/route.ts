import { NextRequest, NextResponse } from 'next/server';
import { DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { r2, BUCKET } from '@/lib/r2';
import { verifyIdTokenFromRequest, assertProjectExists, HttpError } from '@/lib/firebase-admin';

const ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

export async function POST(req: NextRequest) {
  try {
    await verifyIdTokenFromRequest(req);

    const body = await req.json();
    const projectId = body?.projectId;
    const iconIds = body?.iconIds;

    if (typeof projectId !== 'string' || !ID_PATTERN.test(projectId)) {
      return NextResponse.json({ error: 'Invalid projectId' }, { status: 400 });
    }
    if (!Array.isArray(iconIds) || iconIds.some(id => typeof id !== 'string' || !ID_PATTERN.test(id))) {
      return NextResponse.json({ error: 'Invalid iconIds' }, { status: 400 });
    }
    if (iconIds.length === 0) {
      return NextResponse.json({ deleted: 0 });
    }

    await assertProjectExists(projectId);

    await r2.send(new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: {
        Objects: iconIds.map((iconId: string) => ({ Key: `icons/${projectId}/${iconId}.svg` })),
        Quiet: true,
      },
    }));

    return NextResponse.json({ deleted: iconIds.length });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('delete-r2-objects error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
