import { IsEmail, IsString, MinLength } from 'class-validator';

/** Credentials for `POST /api/auth/login` — accepted for both staff and clients. */
export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
