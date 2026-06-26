import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { UsersRepository } from './repositories/users.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async findAll(businessId?: string) {
    const users = await this.usersRepository.findAll(businessId);
    return users.map((user) => this.sanitizeUser(user));
  }

  async findOne(id: string) {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return this.sanitizeUser(user);
  }

  async create(createUserDto: CreateUserDto) {
    const { businessId, pin, email, password, ...rest } = createUserDto;

    // Enforce unique email if provided
    if (email) {
      const emailExists = await this.usersRepository.findByEmail(email);
      if (emailExists) {
        throw new ConflictException(`Email ${email} is already registered`);
      }
    }

    // Since PIN check relies on comparing hashes, we fetch all active PINs for the business and check them
    if (businessId) {
      const activeUsers = await this.usersRepository.findAll(businessId);
      for (const u of activeUsers) {
        const pinMatches = await bcrypt.compare(pin, u.pin);
        if (pinMatches) {
          throw new ConflictException(`PIN is already assigned to another employee in this business`);
        }
      }
    }

    // Hash PIN and password
    const pinHash = await bcrypt.hash(pin, 10);
    let passwordHash: string | undefined;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    const newUser = await this.usersRepository.create({
      ...rest,
      businessId: businessId || null,
      email: email || null,
      pin: pinHash,
      passwordHash: passwordHash || null,
    });

    return this.sanitizeUser(newUser);
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const { pin, email, password, ...rest } = updateUserDto;
    const updates: any = { ...rest };

    // Handle email updates uniqueness
    if (email && email !== user.email) {
      const emailExists = await this.usersRepository.findByEmail(email);
      if (emailExists) {
        throw new ConflictException(`Email ${email} is already registered`);
      }
      updates.email = email;
    }

    // Handle PIN updates uniqueness and hashing
    if (pin) {
      if (user.businessId) {
        const activeUsers = await this.usersRepository.findAll(user.businessId);
        for (const u of activeUsers) {
          if (u.id !== id) {
            const pinMatches = await bcrypt.compare(pin, u.pin);
            if (pinMatches) {
              throw new ConflictException(`PIN is already assigned to another employee in this business`);
            }
          }
        }
      }
      updates.pin = await bcrypt.hash(pin, 10);
    }

    // Handle password hashing
    if (password) {
      updates.passwordHash = await bcrypt.hash(password, 10);
    }

    const updatedUser = await this.usersRepository.update(id, updates);
    return this.sanitizeUser(updatedUser);
  }

  async remove(id: string) {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    await this.usersRepository.softDelete(id);
    return { success: true, message: `User deleted successfully` };
  }

  private sanitizeUser(user: any) {
    if (!user) return null;
    const { passwordHash, pin, ...sanitized } = user;
    return sanitized;
  }
}
