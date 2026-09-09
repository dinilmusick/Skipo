import { NextResponse } from 'next/server';
import {
  loadDatabaseSettings,
  saveDatabaseSettings,
  maskDatabaseSettingsForClient,
  testDatabaseConnection,
} from '../../../lib/db-config';
import { DatabaseSettings } from '../../../lib/types';
import { createSecureRoute } from '@/lib/api-governance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = createSecureRoute({
  id: 'api-db-config-get',
  method: 'GET',
  auth: true,
  rateLimit: { tier: 'CHEAP_READ' },
  handler: async () => {
    const settings = loadDatabaseSettings();
    const masked = maskDatabaseSettingsForClient(settings);
    return NextResponse.json({
      success: true,
      settings: masked,
      environment: {
        isVercel: !!process.env.VERCEL,
        hasEnvDbUrl: !!process.env.DATABASE_URL,
        hasGoogleClientId: !!(process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID),
      },
    });
  },
});

export const POST = createSecureRoute({
  id: 'api-db-config-post',
  method: 'POST',
  auth: true,
  rateLimit: { tier: 'NORMAL_MUTATION' },
  limits: { maxBodySize: 64 * 1024, executionTimeoutMs: 15000 },
  handler: async (_req, { body }) => {
    const incomingSettings: DatabaseSettings = body?.settings;

    if (!incomingSettings || !incomingSettings.engine) {
      return NextResponse.json(
        { success: false, error: 'Invalid database settings payload' },
        { status: 400 }
      );
    }


    // Preserve existing masked secrets if the user didn't overwrite them
    const existing = loadDatabaseSettings();
    const existingGdAccounts = existing.google_drive?.accounts || [];

    const mergedSettings: DatabaseSettings = {
      ...incomingSettings,
      google_drive: incomingSettings.google_drive
        ? {
            ...incomingSettings.google_drive,
            clientSecret:
              incomingSettings.google_drive.clientSecret === '••••••••'
                ? existing.google_drive?.clientSecret || ''
                : incomingSettings.google_drive.clientSecret,
            accounts: (incomingSettings.google_drive.accounts || []).map((incomingAcc) => {
              const savedAcc = existingGdAccounts.find((a) => a.id === incomingAcc.id);
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
      s3_blob: incomingSettings.s3_blob
        ? {
            ...incomingSettings.s3_blob,
            secretAccessKey:
              incomingSettings.s3_blob?.secretAccessKey === '••••••••'
                ? existing.s3_blob?.secretAccessKey || ''
                : incomingSettings.s3_blob?.secretAccessKey || '',
            blobToken:
              incomingSettings.s3_blob?.blobToken === '••••••••'
                ? existing.s3_blob?.blobToken || ''
                : incomingSettings.s3_blob?.blobToken || '',
          }
        : undefined,
      firebase: incomingSettings.firebase
        ? {
            ...incomingSettings.firebase,
            privateKey:
              incomingSettings.firebase?.privateKey === '••••••••'
                ? existing.firebase?.privateKey || ''
                : incomingSettings.firebase?.privateKey || '',
          }
        : undefined,
    };

    // Run connection test before saving if requested
    const testResult = await testDatabaseConnection(mergedSettings);

    mergedSettings.status = testResult.success ? 'connected' : 'error';
    mergedSettings.lastError = testResult.success ? undefined : testResult.message;
    mergedSettings.lastConnectedAt = testResult.success ? new Date().toISOString() : mergedSettings.lastConnectedAt;

    const saved = saveDatabaseSettings(mergedSettings);
    const masked = maskDatabaseSettingsForClient(saved);

    return NextResponse.json({
      success: true,
      settings: masked,
      testResult,
    });
  },
});

