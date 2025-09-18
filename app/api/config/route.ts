import { NextResponse } from 'next/server';

export async function GET() {
  const usersLimit = parseInt(process.env.USERS_LIMIT || '1', 10);

  return NextResponse.json({
    usersLimit,
  });
}
