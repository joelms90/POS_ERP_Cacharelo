import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersRepository } from '../users/repositories/users.repository';
import { AuthRepository } from './repositories/auth.repository';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let usersRepository: UsersRepository;
  let authRepository: AuthRepository;

  const mockUsersRepository = {
    findByEmail: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    findAdminAccessForUser: jest.fn().mockResolvedValue([]),
  };

  const mockAuthRepository = {
    createRefreshToken: jest.fn(),
    findRefreshToken: jest.fn(),
    deleteRefreshToken: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock_token'),
    verify: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersRepository,
          useValue: mockUsersRepository,
        },
        {
          provide: AuthRepository,
          useValue: mockAuthRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersRepository = module.get<UsersRepository>(UsersRepository);
    authRepository = module.get<AuthRepository>(AuthRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should login admin user successfully and return tokens', async () => {
      const dbUser = {
        id: 'user-1',
        name: 'Admin User',
        email: 'admin@example.com',
        passwordHash: await bcrypt.hash('admin123', 10),
        role: 'admin',
        businessId: 'bus-1',
      };

      mockUsersRepository.findByEmail.mockResolvedValue(dbUser);
      mockAuthRepository.createRefreshToken.mockResolvedValue({});

      const result = await service.login({
        email: 'admin@example.com',
        password: 'admin123',
      });

      expect(result).toBeDefined();
      expect(result.accessToken).toBe('mock_token');
      expect(result.refreshToken).toBe('mock_token');
      expect(result.user).toEqual({
        id: 'user-1',
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'admin',
        roles: ['admin'],
        businessId: 'bus-1',
        businessAccess: [{ businessId: 'bus-1', role: 'admin' }],
      });
    });

    it('should throw UnauthorizedException if password does not match', async () => {
      const dbUser = {
        id: 'user-1',
        name: 'Admin User',
        email: 'admin@example.com',
        passwordHash: await bcrypt.hash('admin123', 10),
        role: 'admin',
      };

      mockUsersRepository.findByEmail.mockResolvedValue(dbUser);

      await expect(
        service.login({
          email: 'admin@example.com',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('tabletLogin', () => {
    it('should authenticate operator with valid PIN', async () => {
      const hashedPin = await bcrypt.hash('1111', 10);
      const dbUser = {
        id: 'waiter-1',
        name: 'Juan',
        pin: hashedPin,
        role: 'waiter',
        businessId: 'bus-1',
      };

      mockUsersRepository.findAll.mockResolvedValue([dbUser]);
      mockAuthRepository.createRefreshToken.mockResolvedValue({});

      const result = await service.tabletLogin({
        businessId: 'bus-1',
        pin: '1111',
        deviceId: 'device-1',
      });

      expect(result).toBeDefined();
      expect(result.user.name).toBe('Juan');
    });

    it('should throw UnauthorizedException for invalid PIN', async () => {
      const hashedPin = await bcrypt.hash('1111', 10);
      const dbUser = {
        id: 'waiter-1',
        name: 'Juan',
        pin: hashedPin,
        role: 'waiter',
        businessId: 'bus-1',
      };

      mockUsersRepository.findAll.mockResolvedValue([dbUser]);

      await expect(
        service.tabletLogin({
          businessId: 'bus-1',
          pin: '2222',
          deviceId: 'device-1',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
