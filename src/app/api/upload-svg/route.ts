import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2, BUCKET, R2_PUBLIC_URL } from '@/lib/r2';
import { verifyIdTokenFromRequest, assertProjectOwnership, HttpError } from '@/lib/firebase-admin';

const ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_SVG_BYTES = 1024 * 1024; // 1 MB

export async function POST(req: NextRequest) {
  try {
    const { uid } = await verifyIdTokenFromRequest(req);

    const formData = await req.formData();
    const file = formData.get('file');
    const projectId = formData.get('projectId');
    const iconId = formData.get('iconId');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file must be a File' }, { status: 400 });
    }
    if (typeof projectId !== 'string' || !ID_PATTERN.test(projectId)) {
      return NextResponse.json({ error: 'Invalid projectId' }, { status: 400 });
    }
    if (typeof iconId !== 'string' || !ID_PATTERN.test(iconId)) {
      return NextResponse.json({ error: 'Invalid iconId' }, { status: 400 });
    }
    if (file.size > MAX_SVG_BYTES) {
      return NextResponse.json({ error: 'SVG too large' }, { status: 413 });
    }

    await assertProjectOwnership(projectId, uid);

    const key = `icons/${projectId}/${iconId}.svg`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await r2.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: 'image/svg+xml',
    }));

    return NextResponse.json({ url: `${R2_PUBLIC_URL}/${key}` });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('upload-svg error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
