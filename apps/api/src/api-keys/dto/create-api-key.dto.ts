import { IsString, MinLength } from 'class-validator';

/** Payload for `POST /api-keys` — the `value` is encrypted before storage. */
export class CreateApiKeyDto {
  @IsString()
  @MinLength(1)
  name!: string;

  /** The third-party secret. Stored encrypted; never returned by the API. */
  @IsString()
  @MinLength(1)
  value!: string;
}
