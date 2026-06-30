import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersRepository } from '../users/repositories/users.repository';
import { AuthRepository } from './repositories/auth.repository';
import { LoginDto } from './dto/login.dto';
import { TabletLoginDto } from './dto/tablet-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const user = await this.usersRepository.findByEmail(email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const deviceId = 'web-dashboard';
    return this.generateAuthTokens(user, deviceId);
  }

  async tabletLogin(tabletLoginDto: TabletLoginDto) {
    const { businessId, branchId, pin, deviceId } = tabletLoginDto;
    
    // Fetch active operators for the business (and specific branch if configured)
    const activeUsers = await this.usersRepository.findAll(businessId, branchId);
    let matchedUser = null;

    for (const u of activeUsers) {
      const pinMatches = await bcrypt.compare(pin, u.pin);
      if (pinMatches) {
        matchedUser = u;
        break;
      }
    }

    if (!matchedUser) {
      throw new UnauthorizedException('Invalid login PIN');
    }

    return this.generateAuthTokens(matchedUser, deviceId);
  }

  async refresh(refreshTokenDto: RefreshTokenDto) {
    const { refreshToken, deviceId } = refreshTokenDto;

    try {
      const secret = process.env.JWT_SECRET || 'dev_jwt_secret_key';
      const payload = this.jwtService.verify(refreshToken, { secret });

      const tokenHash = this.hashToken(refreshToken);
      const activeTokenRecord = await this.authRepository.findRefreshToken(tokenHash, deviceId);

      if (!activeTokenRecord) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (new Date() > new Date(activeTokenRecord.expiresAt)) {
        await this.authRepository.deleteRefreshToken(tokenHash);
        throw new UnauthorizedException('Refresh token has expired');
      }

      const user = await this.usersRepository.findById(activeTokenRecord.userId);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Rotate token: delete old, issue new
      await this.authRepository.deleteRefreshToken(tokenHash);
      return this.generateAuthTokens(user, deviceId);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.authRepository.deleteRefreshToken(tokenHash);
    return { success: true, message: 'Logged out successfully' };
  }

  private async generateAuthTokens(user: any, deviceId: string) {
    const jwtPayload = {
      sub: user.id,
      name: user.name,
      role: user.role,
      businessId: user.businessId,
    };

    const secret = process.env.JWT_SECRET || 'dev_jwt_secret_key';

    // Access Token: 15m
    const accessToken = this.jwtService.sign(jwtPayload, {
      secret,
      expiresIn: '15m',
    });

    // Refresh Token: 7d
    const refreshTokenPayload = { ...jwtPayload, jti: crypto.randomUUID() };
    const refreshToken = this.jwtService.sign(refreshTokenPayload, {
      secret,
      expiresIn: '7d',
    });

    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.authRepository.createRefreshToken({
      userId: user.id,
      tokenHash,
      deviceId,
      expiresAt,
    });

    const { passwordHash, pin, ...sanitizedUser } = user;

    return {
      accessToken,
      refreshToken,
      user: sanitizedUser,
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
