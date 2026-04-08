import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2, BUCKET, R2_PUBLIC_URL } from '@/lib/r2';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const projectId = formData.get('projectId') as string | null;
  const iconId = formData.get('iconId') as string | null;

  if (!file || !projectId || !iconId) {
    return NextResponse.json({ error: 'Missing file, projectId, or iconId' }, { status: 400 });
  }

  const key = `icons/${projectId}/${iconId}.svg`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await r2.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: 'image/svg+xml',
  }));

  return NextResponse.json({ url: `${R2_PUBLIC_URL}/${key}` });
}
