import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailService } from './email.service.js';

const send = vi.fn();

// Never talks to the real Resend API — the Resend class is replaced
// wholesale so these tests can't accidentally send real email. A plain
// function (not an arrow function) so it's usable with `new`, matching how
// EmailService actually constructs it.
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function MockResend() {
    return { emails: { send } };
  }),
}));

function buildConfig(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    'mail.resendApiKey': 're_test_key',
    'mail.from': 'Flashcards <noreply@flashcar.click>',
    ...overrides,
  };
  return { get: (key: string) => values[key] };
}

async function buildService(config: ReturnType<typeof buildConfig>) {
  const moduleRef = await Test.createTestingModule({
    providers: [EmailService, { provide: ConfigService, useValue: config }],
  }).compile();
  return moduleRef.get(EmailService);
}

describe('EmailService', () => {
  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue({ data: { id: 'test-id' }, error: null });
  });

  it('sends the registration OTP with the code visible in the body and never as the subject', async () => {
    const service = await buildService(buildConfig());

    await service.sendRegistrationOtp('user@example.com', '123456', 5);

    expect(send).toHaveBeenCalledOnce();
    const message = send.mock.calls[0][0];
    expect(message.to).toBe('user@example.com');
    expect(message.from).toBe('Flashcards <noreply@flashcar.click>');
    expect(message.subject).toBe('Verify your Flashcards account');
    expect(message.subject).not.toContain('123456');
    expect(message.html).toContain('123456');
    expect(message.text).toContain('123456');
  });

  it('sends the password reset OTP with its own subject', async () => {
    const service = await buildService(buildConfig());

    await service.sendPasswordResetOtp('user@example.com', '654321', 5);

    const message = send.mock.calls[0][0];
    expect(message.subject).toBe('Reset your Flashcards password');
    expect(message.html).toContain('654321');
  });

  it('includes an HTML body and a plain-text fallback', async () => {
    const service = await buildService(buildConfig());

    await service.sendRegistrationOtp('user@example.com', '123456', 5);

    const message = send.mock.calls[0][0];
    expect(message.html).toContain('<html');
    expect(typeof message.text).toBe('string');
    expect(message.text.length).toBeGreaterThan(0);
  });

  it('throws a generic error and never sends when Resend is not configured', async () => {
    const service = await buildService(buildConfig({ 'mail.resendApiKey': '' }));

    await expect(service.sendRegistrationOtp('user@example.com', '123456', 5)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(send).not.toHaveBeenCalled();
  });

  it('surfaces a generic error (not the Resend failure detail) when the SDK throws', async () => {
    send.mockRejectedValue(new Error('fetch failed: ECONNREFUSED'));
    const service = await buildService(buildConfig());

    await expect(service.sendRegistrationOtp('user@example.com', '123456', 5)).rejects.toThrow(
      'Email delivery is not available right now. Please try again later.',
    );
  });

  it('surfaces a generic error (not the Resend API error detail) when Resend reports a failure in the response', async () => {
    send.mockResolvedValue({
      data: null,
      error: { message: 'Invalid `from` field', statusCode: 422, name: 'validation_error' },
    });
    const service = await buildService(buildConfig());

    await expect(service.sendRegistrationOtp('user@example.com', '123456', 5)).rejects.toThrow(
      'Email delivery is not available right now. Please try again later.',
    );
  });

  it('never includes the API key anywhere in what gets sent to Resend', async () => {
    const service = await buildService(buildConfig({ 'mail.resendApiKey': 're_super_secret_key' }));

    await service.sendRegistrationOtp('user@example.com', '123456', 5);

    const message = send.mock.calls[0][0];
    expect(JSON.stringify(message)).not.toContain('re_super_secret_key');
  });
});
