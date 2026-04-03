import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requireTeam } from '@/lib/auth/helpers';

export async function POST(request) {
  let cookieStore;
  try {
    cookieStore = await cookies();
    await requireTeam(cookieStore);
  } catch {
    return NextResponse.json(
      { error: 'CB-AUTH-003: Not authorized' },
      { status: 401 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json(
        { error: 'CB-API-001: File is required' },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    let text = '';

    if (fileName.endsWith('.txt')) {
      text = await file.text();
    } else if (fileName.endsWith('.pdf')) {
      const pdfParse = (await import('pdf-parse')).default;
      const buffer = Buffer.from(await file.arrayBuffer());
      const data = await pdfParse(buffer);
      text = data.text;
    } else if (fileName.endsWith('.docx')) {
      const mammoth = await import('mammoth');
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Use .txt, .pdf, or .docx' },
        { status: 400 }
      );
    }

    if (!text || text.trim().length < 10) {
      return NextResponse.json(
        { error: 'Could not extract text from file. The file may be empty or image-only.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, text: text.trim() });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      if (process.env.NODE_ENV === 'development') console.error('File parse error:', err?.message || err);
    }
    return NextResponse.json(
      { error: 'Failed to parse file. Please try a different format.' },
      { status: 500 }
    );
  }
}
