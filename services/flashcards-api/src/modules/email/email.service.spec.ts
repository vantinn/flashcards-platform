import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailService } from './email.service.js';

const sendMail = vi.fn();

// Never talks to a real SMTP server / Gmail — createTransport is replaced
// wholesale so these tests can't accidentally send real email.
vi.mock('nodemailer', () => ({
  createTransport: vi.fn(() => ({ sendMail })),
}));

function buildConfig(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    'mail.gmailUser': 'sender@gmail.com',
    'mail.gmailAppPassword': 'app-password',
    'mail.fromName': 'Flashcards',
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
    sendMail.mockReset();
    sendMail.mockResolvedValue({ messageId: 'test' });
  });

  it('sends the registration OTP with the code visible in the body and never as the subject', async () => {
    const service = await buildService(buildConfig());

    await service.sendRegistrationOtp('user@example.com', '123456', 5);

    expect(sendMail).toHaveBeenCalledOnce();
    const message = sendMail.mock.calls[0][0];
    expect(message.to).toBe('user@example.com');
    expect(message.subject).toBe('Verify your Flashcards account');
    expect(message.html).toContain('123456');
    expect(message.text).toContain('123456');
  });

  it('sends the password reset OTP with its own subject', async () => {
    const service = await buildService(buildConfig());

    await service.sendPasswordResetOtp('user@example.com', '654321', 5);

    const message = sendMail.mock.calls[0][0];
    expect(message.subject).toBe('Reset your Flashcards password');
    expect(message.html).toContain('654321');
  });

  it('throws a generic error and never sends when Gmail credentials are not configured', async () => {
    const service = await buildService(buildConfig({ 'mail.gmailUser': '', 'mail.gmailAppPassword': '' }));

    await expect(service.sendRegistrationOtp('user@example.com', '123456', 5)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('surfaces a generic error (not the SMTP failure detail) when sending fails', async () => {
    sendMail.mockRejectedValue(new Error('Invalid login: 535-5.7.8 credentials rejected'));
    const service = await buildService(buildConfig());

    await expect(service.sendRegistrationOtp('user@example.com', '123456', 5)).rejects.toThrow(
      'Email delivery is not available right now. Please try again later.',
    );
  });
});
