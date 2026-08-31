import { Body, Controller, Get, NotFoundException, Patch } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { UsersService } from './users.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@CurrentUser() currentUser: AuthenticatedUser) {
    const user = await this.usersService.findById(currentUser.id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.usersService.toPublic(user);
  }

  @Patch('me')
  async updateMe(@CurrentUser() currentUser: AuthenticatedUser, @Body() dto: UpdateUserDto) {
    const user = await this.usersService.update(currentUser.id, dto);
    return this.usersService.toPublic(user);
  }
}
