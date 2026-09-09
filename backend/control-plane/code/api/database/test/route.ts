import { NextResponse } from 'next/server';
import { testDatabaseConnection, loadDatabaseSettings } from '../../../../lib/db-config';
import { DatabaseSettings } from '../../../../lib/types';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = createSecureRoute({
  id: 'api-database-test-post',
  method: 'POST',
  auth: true,
  rateLimit: { tier: 'NORMAL_MUTATION' },
  limits: { maxBodySize: 64 * 1024, executionTimeoutMs: 15000 },
  handler: async (_req, { body }) => {
    const settings: DatabaseSettings = body?.settings;

    if (!settings || !settings.engine) {
      return NextResponse.json(
        { success: false, error: 'Database settings object is required' },
        { status: 400 }
      );
    }

    // Replace masked password placeholder with actual saved credentials if needed
    const saved = loadDatabaseSettings();
    const savedGdAccounts = saved.google_drive?.accounts || [];

    const settingsToTest: DatabaseSettings = {
      ...settings,
      google_drive: settings.google_drive
        ? {
            ...settings.google_drive,
            clientSecret:
              settings.google_drive.clientSecret === '••••••••'
                ? saved.google_drive?.clientSecret || ''
                : settings.google_drive.clientSecret,
            accounts: (settings.google_drive.accounts || []).map((incomingAcc) => {
              const savedAcc = savedGdAccounts.find((a) => a.id === incomingAcc.id);
              return {
                ...incomingAcc,
                clientSecret:
                  incomingAcc.clientSecret === '••••••••'
                    ? savedAcc?.clientSecret || ''
                    : incomingAcc.clientSecret,
                accessToken:
                  incomingAcc.accessToken === '••••••••'
                    ? savedAcc?.accessToken || ''
                    : incomingAcc.accessToken,
                refreshToken:
                  incomingAcc.refreshToken === '••••••••'
                    ? savedAcc?.refreshToken || ''
                    : incomingAcc.refreshToken,
              };
            }),
          }
        : undefined,
      s3_blob: settings.s3_blob
        ? {
            ...settings.s3_blob,
            secretAccessKey:
              settings.s3_blob?.secretAccessKey === '••••••••'
                ? saved.s3_blob?.secretAccessKey || ''
                : settings.s3_blob?.secretAccessKey || '',
            blobToken:
              settings.s3_blob?.blobToken === '••••••••'
                ? saved.s3_blob?.blobToken || ''
                : settings.s3_blob?.blobToken || '',
          }
        : undefined,
      firebase: settings.firebase
        ? {
            ...settings.firebase,
            privateKey:
              settings.firebase?.privateKey === '••••••••'
                ? saved.firebase?.privateKey || ''
                : settings.firebase?.privateKey || '',
          }
        : undefined,
    };

    const testResult = await testDatabaseConnection(settingsToTest);

    return NextResponse.json({
      success: testResult.success,
      testResult,
    });
  },
});

