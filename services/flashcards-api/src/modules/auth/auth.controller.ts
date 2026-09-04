import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { Response, Request } from 'express';
import { Public } from '../../common/decorators/public.decorator.js';
import { rateLimit } from '../../common/guards/rate-limit.guard.js';
import { UsersService, type PublicUser } from '../users/users.service.js';
import type { User } from '../users/entities/user.entity.js';
import { AuthService, TokenPair } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { GoogleTokenDto } from './dto/google-token.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { ResendOtpDto } from './dto/resend-otp.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import type { GoogleProfile } from './strategies/google.strategy.js';

interface PublicUserWithTokens extends PublicUser {
  accessToken: string;
  refreshToken: string;
}

const ACCESS_COOKIE_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes, mirrors auth.jwtAccessExpiresIn default
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, mirrors auth.jwtRefreshExpiresIn default

// Credential-guessing targets get a tight window; refresh is less
// sensitive (it needs a valid refresh token already) but still capped.
const CREDENTIAL_RATE_LIMIT = { limit: 10, windowMs: 60_000 };
const REFRESH_RATE_LIMIT = { limit: 30, windowMs: 60_000 };

// OTP endpoints get their own IP-level ceiling on top of the per-account
// cooldown/hourly-cap enforced in OtpService — this is the first line of
// defense against a single IP hammering many different email addresses.
const OTP_VERIFY_RATE_LIMIT = { limit: 15, windowMs: 60_000 };
const OTP_REQUEST_RATE_LIMIT = { limit: 5, windowMs: 60_000 };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  // No tokens/cookies here — the account isn't usable until the OTP sent
  // to this address is confirmed via /auth/verify-registration.
  @Public()
  @UseGuards(rateLimit(CREDENTIAL_RATE_LIMIT))
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @UseGuards(rateLimit(OTP_VERIFY_RATE_LIMIT))
  @Post('verify-registration')
  @HttpCode(HttpStatus.OK)
  async verifyRegistration(@Body() dto: VerifyOtpDto, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.authService.verifyRegistration(dto);
    this.setAuthCookies(res, tokens);
    return this.toPublicWithTokens(user, tokens);
  }

  @Public()
  @UseGuards(rateLimit(OTP_REQUEST_RATE_LIMIT))
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  async resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  @Public()
  @UseGuards(rateLimit(OTP_REQUEST_RATE_LIMIT))
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @UseGuards(rateLimit(OTP_VERIFY_RATE_LIMIT))
  @Post('verify-reset-otp')
  @HttpCode(HttpStatus.OK)
  async verifyResetOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyResetOtp(dto);
  }

  @Public()
  @UseGuards(rateLimit(CREDENTIAL_RATE_LIMIT))
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @UseGuards(rateLimit(CREDENTIAL_RATE_LIMIT))
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.authService.login(dto);
    this.setAuthCookies(res, tokens);
    return this.toPublicWithTokens(user, tokens);
  }

  @Public()
  @UseGuards(rateLimit(REFRESH_RATE_LIMIT))
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Body() dto: RefreshDto, @Res({ passthrough: true }) res: Response) {
    // Web sends no body and relies on the refresh_token cookie; mobile has
    // no cookie jar in the same sense and sends the token it stored itself.
    const refreshToken = (req as { cookies?: Record<string, string> }).cookies?.refresh_token ?? dto.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    const { user, tokens } = await this.authService.refresh(refreshToken);
    this.setAuthCookies(res, tokens);
    return this.toPublicWithTokens(user, tokens);
  }

  @Public()
  @UseGuards(rateLimit(CREDENTIAL_RATE_LIMIT))
  @Post('google/token')
  @HttpCode(HttpStatus.OK)
  async googleToken(@Body() dto: GoogleTokenDto, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.authService.loginWithGoogleIdToken(dto.idToken);
    this.setAuthCookies(res, tokens);
    return this.toPublicWithTokens(user, tokens);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) res: Response) {
    // path must match what setAuthCookies() set (Express's clearCookie
    // defaults path to '/' anyway, but this makes the match explicit rather
    // than relying on that default staying true across versions) — a
    // mismatched path means the browser won't recognize this as the same
    // cookie and silently keeps the old one alive.
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
  }

  @Public()
  @UseGuards(AuthGuard('google'))
  @Get('google')
  googleLogin() {
    // Passport's google strategy intercepts this request and redirects to
    // Google's consent screen — nothing to do here.
  }

  @Public()
  @UseGuards(AuthGuard('google'))
  @Get('google/callback')
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const profile = req.user as GoogleProfile;
    const { tokens } = await this.authService.loginWithGoogle(profile);
    this.setAuthCookies(res, tokens);

    const webUrl = this.configService.get<string>('app.webUrl');
    res.redirect(`${webUrl}/dashboard`);
  }

  // Cookies remain the actual auth mechanism for the web app; these token
  // fields are additive so a mobile client (no cookie jar) can read the
  // tokens straight from the response body and store them itself. Existing
  // web callers just ignore the extra fields — the response shape they
  // already depend on (a flat PublicUser) is unchanged.
  private toPublicWithTokens(user: User, tokens: TokenPair): PublicUserWithTokens {
    return { ...this.usersService.toPublic(user), accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  // sameSite stays 'lax' (not 'none') in every environment, including
  // production: the frontend (apps/flashcards-web) proxies its browser-side
  // API calls through its own origin via Next.js rewrites (see
  // next.config.ts there) specifically so these cookies are always set as
  // first-party, same-site cookies from the browser's point of view — even
  // though the frontend (Vercel) and this API (Railway) are different
  // registrable domains at the HTTP level. Deliberately not set: no
  // `domain` attribute (host-only cookie — this API's own host is the only
  // one that should ever receive it), and no `secure: false` fallback in
  // dev beyond NODE_ENV driving it automatically (plain HTTP locally).
  private setAuthCookies(res: Response, tokens: TokenPair) {
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: ACCESS_COOKIE_MAX_AGE_MS,
      path: '/',
    });

    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
      path: '/',
    });
  }
}
