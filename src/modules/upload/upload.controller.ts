import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiBody, ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { UploadService } from './upload.service';
import {
  UPLOAD_ALLOWED_MIME,
  UPLOAD_MAX_SIZE_BYTES,
} from '../../common/constants';

@ApiTags('Upload')
@ApiBearerAuth('JWT-auth')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase() || '.bin';
          cb(null, `${uuidv4()}${ext}`);
        },
      }),
      limits: { fileSize: UPLOAD_MAX_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!UPLOAD_ALLOWED_MIME.includes(file.mimetype as (typeof UPLOAD_ALLOWED_MIME)[number])) {
          return cb(
            new BadRequestException(
              'Chỉ chấp nhận file ảnh (jpg, png, webp, gif)',
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({
    description: 'Upload image success',
    schema: {
      example: {
        code: 201,
        message: 'success',
        data: { url: 'http://localhost:8080/uploads/example.jpg' },
      },
    },
  })
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Không có file được tải lên');
    return { url: this.uploadService.getImageUrl(file.filename) };
  }
}
