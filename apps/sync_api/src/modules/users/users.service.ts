import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { UsersRepository } from './repositories/users.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import * as bcrypt from 'bcrypt';
import { ADMIN_ROLES, UserRole } from '../auth/roles';
import { BranchesRepository } from '../branches/repositories/branches.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly branchesRepository: BranchesRepository,
  ) {}

  async findAll(businessId?: string, branchId?: string) {
    const users = await this.usersRepository.findAll(businessId, branchId);
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
    const { businessId, branchId, pin, email, password, role, roles, ...rest } = createUserDto;
    const normalizedRoles = this.normalizeRoles(roles, role);
    await this.validateBranchForBusiness(businessId, branchId);

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
      branchId: branchId || null,
      email: email || null,
      pin: pinHash,
      passwordHash: passwordHash || null,
      role: normalizedRoles[0],
      roles: normalizedRoles,
    });

    return this.sanitizeUser(newUser);
  }

  async findBusinessAdmins(businessId: string) {
    const users = await this.usersRepository.findAll();
    const adminUsers = users.filter((user) => ADMIN_ROLES.includes(user.role as any));
    const accessRows = await this.usersRepository.findAdminAccessForUsers(
      adminUsers.map((user) => user.id),
    );
    return adminUsers
      .map((user) => this.sanitizeAdminUser(user, accessRows))
      .filter((user) =>
        user.businessAccess.some((access: { businessId: string }) => access.businessId === businessId) ||
        user.businessId === businessId,
      );
  }

  async createBusinessAdmin(createUserDto: CreateAdminUserDto) {
    if (!createUserDto.businessId) {
      throw new BadRequestException('businessId is required');
    }
    if (!ADMIN_ROLES.includes(createUserDto.role as any)) {
      throw new BadRequestException('role must be owner, inventory_admin, or support_tech');
    }
    if (!createUserDto.email || !createUserDto.password) {
      throw new BadRequestException('email and password are required for Business Control admins');
    }

    const pin = createUserDto.pin || this.generateRandomPin();

    const newUser = await this.create({
      ...createUserDto,
      branchId: undefined,
      pin,
    });
    await this.usersRepository.replaceAdminAccess(
      newUser.id,
      this.normalizeAdminAccess(createUserDto.businessId, createUserDto.role, createUserDto.businessAccess),
    );
    return this.findOneAdmin(newUser.id);
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const { branchId, pin, email, password, role, roles, ...rest } = updateUserDto;
    const updates: any = { ...rest };
    const normalizedRoles = roles !== undefined
      ? this.normalizeRoles(roles, role ?? user.role)
      : role !== undefined
        ? this.normalizeRoles(undefined, role)
        : undefined;

    if (
      user.role === 'owner' &&
      user.businessId &&
      updateUserDto.role &&
      updateUserDto.role !== 'owner'
    ) {
      const ownerCount = await this.usersRepository.countActiveOwners(user.businessId);
      if (ownerCount <= 1) {
        throw new BadRequestException('No puedes cambiar el rol del ultimo owner activo.');
      }
    }

    if (branchId !== undefined) {
      await this.validateBranchForBusiness(user.businessId, branchId);
      updates.branchId = branchId || null;
    }

    if (normalizedRoles) {
      updates.role = normalizedRoles[0];
      updates.roles = normalizedRoles;
    }

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

  async findOneAdmin(id: string) {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    const accessRows = await this.usersRepository.findAdminAccessForUser(id);
    return this.sanitizeAdminUser(user, accessRows);
  }

  async updateBusinessAdmin(id: string, updateUserDto: UpdateAdminUserDto) {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    if (!ADMIN_ROLES.includes(user.role as any)) {
      throw new BadRequestException('User is not a Business Control admin');
    }
    if (updateUserDto.role && !ADMIN_ROLES.includes(updateUserDto.role as any)) {
      throw new BadRequestException('role must be owner, inventory_admin, or support_tech');
    }
    const { businessAccess, ...userUpdates } = updateUserDto;
    const updated = await this.update(id, {
      ...userUpdates,
      branchId: undefined,
    });
    if (businessAccess) {
      await this.usersRepository.replaceAdminAccess(
        id,
        this.normalizeAdminAccess(user.businessId, updateUserDto.role || user.role, businessAccess),
      );
    }
    return this.findOneAdmin(updated.id);
  }

  async remove(id: string) {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    if (user.role === 'owner' && user.businessId) {
      const ownerCount = await this.usersRepository.countActiveOwners(user.businessId);
      if (ownerCount <= 1) {
        throw new BadRequestException('No puedes desactivar el ultimo owner activo.');
      }
    }
    await this.usersRepository.softDelete(id);
    return { success: true, message: `User deleted successfully` };
  }

  async deactivateBusinessAdmin(id: string, actorUserId?: string) {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    if (!ADMIN_ROLES.includes(user.role as any)) {
      throw new BadRequestException('User is not a Business Control admin');
    }
    if (user.role === 'owner' && user.businessId) {
      const ownerCount = await this.usersRepository.countActiveOwners(user.businessId);
      if (ownerCount <= 1) {
        throw new BadRequestException('No puedes desactivar el ultimo owner activo.');
      }
      if (actorUserId === id && ownerCount <= 1) {
        throw new BadRequestException('No puedes desactivar tu propio acceso owner.');
      }
    }
    await this.usersRepository.softDelete(id);
    return { success: true, message: 'Administrador desactivado correctamente' };
  }

  private sanitizeUser(user: any) {
    if (!user) return null;
    const { passwordHash, pin, ...sanitized } = user;
    return {
      ...sanitized,
      roles: this.normalizeRoles(sanitized.roles, sanitized.role),
    };
  }

  private sanitizeAdminUser(user: any, accessRows: any[]) {
    const sanitized = this.sanitizeUser(user);
    const businessAccess = accessRows
      .filter((access) => access.userId === user.id)
      .map((access) => ({
        businessId: access.businessId,
        role: access.role,
      }));

    if (businessAccess.length === 0 && user.businessId && ADMIN_ROLES.includes(user.role as any)) {
      businessAccess.push({
        businessId: user.businessId,
        role: user.role,
      });
    }

    return {
      ...sanitized,
      businessAccess,
    };
  }

  private normalizeAdminAccess(
    defaultBusinessId: string | null | undefined,
    defaultRole: string,
    access?: Array<{ businessId: string; role: string }>,
  ) {
    const source = access?.length
      ? access
      : defaultBusinessId
        ? [{ businessId: defaultBusinessId, role: defaultRole }]
        : [];
    const unique = new Map<string, { businessId: string; role: string }>();
    for (const item of source) {
      if (!ADMIN_ROLES.includes(item.role as any)) {
        throw new BadRequestException('businessAccess role must be owner, inventory_admin, or support_tech');
      }
      unique.set(item.businessId, {
        businessId: item.businessId,
        role: item.role,
      });
    }
    return Array.from(unique.values());
  }

  private async validateBranchForBusiness(
    businessId: string | null | undefined,
    branchId: string | null | undefined,
  ) {
    if (!branchId) return;
    if (!businessId) {
      throw new BadRequestException('businessId is required when assigning a branch.');
    }

    const branch = await this.branchesRepository.findById(branchId);
    if (!branch) {
      throw new BadRequestException('La sucursal seleccionada no existe.');
    }
    if (branch.businessId !== businessId) {
      throw new BadRequestException('La sucursal seleccionada no pertenece a este negocio.');
    }
  }

  private generateRandomPin(): string {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  private normalizeRoles(roles?: unknown, fallbackRole?: string): UserRole[] {
    const source = Array.isArray(roles) && roles.length > 0
      ? roles
      : fallbackRole
        ? [fallbackRole]
        : [];
    const normalized = Array.from(
      new Set(
        source
          .map((role) => role?.toString().trim())
          .filter((role): role is UserRole => Boolean(role)),
      ),
    );
    if (normalized.length === 0) {
      throw new BadRequestException('At least one role must be selected');
    }
    return normalized;
  }
}
