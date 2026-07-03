import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const groupName = formData.get('groupName') as string;
    const fieldOfStudy = formData.get('fieldOfStudy') as string || '';

    if (!file || !groupName) {
      return NextResponse.json({ error: 'Missing file or group name' }, { status: 400 });
    }

    const xlsx = await import('xlsx');
    
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet) as any[];

    const getVal = (row: any, keywords: string[]) => {
      const key = Object.keys(row).find(k => keywords.some(kw => k.toLowerCase().includes(kw.toLowerCase())));
      return key ? String(row[key]).trim() : '';
    };

    const students = data.map((row: any) => ({
      studentId: getVal(row, ['รหัสนักศึกษา', 'รหัส', 'id', 'student id']),
      name: getVal(row, ['ชื่อ', 'name']),
      name_en: getVal(row, ['name (en)', 'name en', 'english name']),
      group: getVal(row, ['กลุ่ม', 'กลุ่ม', 'group']),
      email: getVal(row, ['email', 'e-mail', 'อีเมล']),
    })).filter(s => s.email && s.name);

    if (students.length === 0) {
      return NextResponse.json({ error: 'No valid students found in the file. Ensure the headers are correct (รหัสนักศึกษา, ชื่อ, Email).' }, { status: 400 });
    }

    // Save Group
    const groupRef = adminDb.collection('studentGroups').doc();
    await groupRef.set({
      id: groupRef.id,
      name: groupName,
      fieldOfStudy,
      students
    });

    // Also pre-register these students as Users so they can log in
    const batch = adminDb.batch();
    for (const student of students) {
      // Use email as doc ID or query. To be safe, we generate a doc and store email.
      const userRef = adminDb.collection('users').doc();
      batch.set(userRef, {
        uid: userRef.id,
        email: student.email,
        name_th: student.name,
        name_en: '',
        role: 'Student',
        createdAt: Date.now()
      });
    }
    await batch.commit();

    return NextResponse.json({ success: true, groupId: groupRef.id, studentCount: students.length });
  } catch (error: any) {
    console.error('Error processing group upload:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
