import { Role } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

/** Optional filters for `GET /users`. */
export class ListUsersQueryDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
