import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UsersRepository } from './repositories/users.repository';
import { ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('UsersService', () => {
  let service: UsersService;
  let repository: UsersRepository;

  const mockUsersRepository = {
    findAll: jest.fn(),
    findById: jest.fn(),
    findByPin: jest.fn(),
    findByEmail: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UsersRepository,
          useValue: mockUsersRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get<UsersRepository>(UsersRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return sanitized users list', async () => {
      const dbUsers = [
        { id: '1', name: 'User 1', pin: 'hash1', passwordHash: 'pwd1', role: 'waiter' },
        { id: '2', name: 'User 2', pin: 'hash2', passwordHash: 'pwd2', role: 'cashier' },
      ];
      mockUsersRepository.findAll.mockResolvedValue(dbUsers);

      const result = await service.findAll('bus-1');
      expect(result).toEqual([
        { id: '1', name: 'User 1', role: 'waiter' },
        { id: '2', name: 'User 2', role: 'cashier' },
      ]);
      expect(repository.findAll).toHaveBeenCalledWith('bus-1');
    });
  });

  describe('findOne', () => {
    it('should return a sanitized user by ID', async () => {
      const dbUser = { id: '1', name: 'User 1', pin: 'hash1', passwordHash: 'pwd1', role: 'waiter' };
      mockUsersRepository.findById.mockResolvedValue(dbUser);

      const result = await service.findOne('1');
      expect(result).toEqual({ id: '1', name: 'User 1', role: 'waiter' });
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUsersRepository.findById.mockResolvedValue(null);
      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create and return a sanitized user', async () => {
      const createUserDto = {
        name: 'New Waiter',
        pin: '1234',
        role: 'waiter' as const,
        businessId: 'bus-1',
      };

      mockUsersRepository.findAll.mockResolvedValue([]);
      mockUsersRepository.create.mockResolvedValue({
        id: 'new-id',
        name: 'New Waiter',
        pin: 'hashed_pin',
        role: 'waiter',
        businessId: 'bus-1',
      });

      const result = await service.create(createUserDto);
      expect(result).toEqual({
        id: 'new-id',
        name: 'New Waiter',
        role: 'waiter',
        businessId: 'bus-1',
      });
      expect(repository.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if PIN is already assigned', async () => {
      const createUserDto = {
        name: 'New Waiter',
        pin: '1234',
        role: 'waiter' as const,
        businessId: 'bus-1',
      };

      const hashedPin = await bcrypt.hash('1234', 10);
      mockUsersRepository.findAll.mockResolvedValue([
        { id: '1', pin: hashedPin },
      ]);

      await expect(service.create(createUserDto)).rejects.toThrow(ConflictException);
    });
  });
});
