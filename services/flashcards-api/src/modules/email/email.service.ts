import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

interface OtpEmailContent {
  subject: string;
  heading: string;
  intro: string;
  code: string;
  expiresInMinutes: number;
}

function renderHtml(content: OtpEmailContent): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;padding:32px;">
            <tr>
              <td style="font-size:20px;font-weight:700;color:#1f2937;padding-bottom:16px;">Flashcards</td>
            </tr>
            <tr>
              <td style="font-size:16px;color:#1f2937;padding-bottom:8px;font-weight:600;">${content.heading}</td>
            </tr>
            <tr>
              <td style="font-size:14px;color:#4b5563;padding-bottom:24px;line-height:1.5;">${content.intro}</td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <span style="display:inline-block;font-size:32px;letter-spacing:8px;font-weight:700;color:#111827;background:#f4f5f7;padding:16px 24px;border-radius:6px;">${content.code}</span>
              </td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#6b7280;padding-bottom:8px;">This code expires in ${content.expiresInMinutes} minutes.</td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#6b7280;">If you didn't request this, you can safely ignore this email — do not share this code with anyone.</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderText(content: OtpEmailContent): string {
  return `${content.heading}\n\n${content.intro}\n\nYour verification code: ${content.code}\n\nThis code expires in ${content.expiresInMinutes} minutes.\n\nIf you didn't request this, you can safely ignore this email — do not share this code with anyone.`;
}

/**
 * Thin wrapper around a Gmail SMTP transporter. Kept out of AuthService so
 * SMTP concerns (transport setup, templating, from-address) live in exactly
 * one place, and so AuthService's tests never need a real transporter.
 *
 * Never logs the OTP code itself, per the OTP-as-sensitive-authentication-data
 * requirement — only that a send was attempted and whether it succeeded.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null;
  private readonly fromAddress: string;
  private readonly fromName: string;

  constructor(private readonly configService: ConfigService) {
    const gmailUser = this.configService.get<string>('mail.gmailUser');
    const gmailAppPassword = this.configService.get<string>('mail.gmailAppPassword');
    this.fromName = this.configService.get<string>('mail.fromName')!;
    this.fromAddress = gmailUser ?? '';

    // Left unconfigured in dev is a valid state (see mail.config.ts) — sends
    // just fail loudly and specifically instead of throwing on an
    // undefined transporter deep inside nodemailer.
    this.transporter =
      gmailUser && gmailAppPassword
        ? createTransport({
            service: 'gmail',
            auth: { user: gmailUser, pass: gmailAppPassword },
          })
        : null;
  }

  async sendRegistrationOtp(email: string, code: string, expiresInMinutes: number): Promise<void> {
    await this.send(email, {
      subject: 'Verify your Flashcards account',
      heading: 'Verify your email address',
      intro: 'Use the code below to finish creating your Flashcards account.',
      code,
      expiresInMinutes,
    });
  }

  async sendPasswordResetOtp(email: string, code: string, expiresInMinutes: number): Promise<void> {
    await this.send(email, {
      subject: 'Reset your Flashcards password',
      heading: 'Reset your password',
      intro: 'Use the code below to reset your Flashcards password. If you did not request this, you can ignore this email and your password will stay the same.',
      code,
      expiresInMinutes,
    });
  }

  private async send(to: string, content: OtpEmailContent): Promise<void> {
    if (!this.transporter) {
      this.logger.error('Email send skipped: Gmail credentials are not configured (GMAIL_USER/GMAIL_APP_PASSWORD).');
      throw new ServiceUnavailableException('Email delivery is not available right now. Please try again later.');
    }

    try {
      await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromAddress}>`,
        to,
        subject: content.subject,
        html: renderHtml(content),
        text: renderText(content),
      });
      this.logger.log(`Email sent: subject="${content.subject}"`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Email send failed: subject="${content.subject}" reason=${message}`);
      throw new ServiceUnavailableException('Email delivery is not available right now. Please try again later.');
    }
  }
}
