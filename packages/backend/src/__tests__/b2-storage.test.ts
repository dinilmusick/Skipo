import { describe, it, expect } from 'vitest';
import {
  resolveBackblazeEndpoint,
  normalizeBackblazeCredentials,
  StorageAdapterFactory,
  BackblazeB2Adapter,
  S3Adapter,
} from '../storage/index.js';

describe('Backblaze B2 Endpoint and Credential Normalizer', () => {
  it('resolves full B2 endpoint URLs', () => {
    const res = resolveBackblazeEndpoint('s3.eu-central-003.backblazeb2.com');
    expect(res.region).toBe('eu-central-003');
    expect(res.endpoint).toBe('https://s3.eu-central-003.backblazeb2.com');
  });

  it('resolves naked region identifiers', () => {
    const res = resolveBackblazeEndpoint('us-east-005');
    expect(res.region).toBe('us-east-005');
    expect(res.endpoint).toBe('https://s3.us-east-005.backblazeb2.com');
  });

  it('auto-detects region from keyID prefix', () => {
    const res003 = resolveBackblazeEndpoint('', '003testdummykeyid1234567');
    expect(res003.region).toBe('eu-central-003');
    expect(res003.endpoint).toBe('https://s3.eu-central-003.backblazeb2.com');

    const res005 = resolveBackblazeEndpoint('', '005abcd1234efgh5678ijkl9');
    expect(res005.region).toBe('us-east-005');
    expect(res005.endpoint).toBe('https://s3.us-east-005.backblazeb2.com');
  });

  it('auto-swaps swapped keyID and applicationKey', () => {
    const swapped = normalizeBackblazeCredentials(
      'K003testdummyappkey12345678901',
      '003testdummykeyid1234567'
    );
    expect(swapped.keyId).toBe('003testdummykeyid1234567');
    expect(swapped.appKey).toBe('K003testdummyappkey12345678901');
  });

  it('parses pasted multiline key blocks', () => {
    const block = `keyID: 003testdummykeyid1234567\napplicationKey: K003testdummyappkey12345678901`;
    const res = normalizeBackblazeCredentials(block, '');
    expect(res.keyId).toBe('003testdummykeyid1234567');
    expect(res.appKey).toBe('K003testdummyappkey12345678901');
  });

  it('creates BackblazeB2Adapter from StorageAdapterFactory', () => {
    const adapter = StorageAdapterFactory.create({
      provider: 'backblaze_b2',
      b2BucketName: 'test-workspace',
      b2KeyId: '003testdummykeyid1234567',
      b2ApplicationKey: 'K003testdummyappkey12345678901',
      b2Endpoint: 's3.eu-central-003.backblazeb2.com',
    });
    expect(adapter).toBeInstanceOf(BackblazeB2Adapter);
  });

  it('creates S3Adapter from StorageAdapterFactory', () => {
    const adapter = StorageAdapterFactory.create({
      provider: 's3',
      bucket: 'my-s3-bucket',
      accessKey: 'AKIA123',
      secretKey: 'secret123',
    });
    expect(adapter).toBeInstanceOf(S3Adapter);
  });
});
