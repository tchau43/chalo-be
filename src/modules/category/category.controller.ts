import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiQuery, ApiOkResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@ApiTags('Menu - Category')
@Controller('menu/category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get('list')
  @Public()
  @SkipThrottle()
  @ApiOkResponse({ description: 'Category list', schema: { example: { code: 200, message: 'success', data: [] } } })
  list() {
    return this.categoryService.list();
  }

  @Get('simple-list')
  @Public()
  @SkipThrottle()
  @ApiOkResponse({ description: 'Simple category list', schema: { example: { code: 200, message: 'success', data: [{ id: 'uuid', name: 'Coffee' }] } } })
  simpleList() {
    return this.categoryService.simpleList();
  }

  @Get('detail')
  @ApiBearerAuth('JWT-auth')
  @ApiQuery({ name: 'id', required: true })
  @ApiOkResponse({ description: 'Category detail', schema: { example: { code: 200, message: 'success', data: { id: 'uuid', name: 'Coffee' } } } })
  detail(@Query('id') id: string) {
    return this.categoryService.detail(id);
  }

  @Post('create')
  @ApiBearerAuth('JWT-auth')
  @Roles(UserRole.ADMIN)
  @ApiOkResponse({ description: 'Create category success', schema: { example: { code: 201, message: 'success', data: { id: 'uuid', name: 'Coffee' } } } })
  create(@Body() dto: CreateCategoryDto) {
    return this.categoryService.create(dto);
  }

  @Put('update')
  @ApiBearerAuth('JWT-auth')
  @Roles(UserRole.ADMIN)
  @ApiOkResponse({ description: 'Update category success', schema: { example: { code: 200, message: 'success', data: { id: 'uuid', name: 'Coffee Updated' } } } })
  update(@Body() dto: UpdateCategoryDto) {
    return this.categoryService.update(dto);
  }

  @Delete('delete')
  @ApiBearerAuth('JWT-auth')
  @Roles(UserRole.ADMIN)
  @ApiQuery({ name: 'id', required: true })
  @ApiOkResponse({ description: 'Delete category success', schema: { example: { code: 200, message: 'success', data: null } } })
  delete(@Query('id') id: string) {
    return this.categoryService.delete(id);
  }
}
