import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UploadService {
  constructor(private readonly configService: ConfigService) {}

  getImageUrl(filename: string): string {
    const appUrl = this.configService.get<string>('APP_URL', 'http://localhost:8080');
    return `${appUrl}/uploads/${filename}`;
  }
}
