import { NextRequest, NextResponse } from 'next/server';
import { DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { r2, BUCKET } from '@/lib/r2';

export async function POST(req: NextRequest) {
  const { keys }: { keys: string[] } = await req.json();

  if (!keys || keys.length === 0) {
    return NextResponse.json({ deleted: 0 });
  }

  await r2.send(new DeleteObjectsCommand({
    Bucket: BUCKET,
    Delete: {
      Objects: keys.map(key => ({ Key: key })),
      Quiet: true,
    },
  }));

  return NextResponse.json({ deleted: keys.length });
}
