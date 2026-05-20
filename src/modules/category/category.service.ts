import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
  ) {}

  async list() {
    const categories = await this.categoryRepo
      .createQueryBuilder('c')
      .loadRelationCountAndMap(
        'c.productCount',
        'c.products',
        'p',
        (qb) => qb.where('p.isActive = true'),
      )
      .orderBy('c.sortOrder', 'ASC')
      .addOrderBy('c.createdAt', 'ASC')
      .getMany();
    return categories;
  }

  async simpleList() {
    return this.categoryRepo.find({
      select: ['id', 'name'],
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async detail(id: string) {
    const category = await this.categoryRepo
      .createQueryBuilder('c')
      .where('c.id = :id', { id })
      .loadRelationCountAndMap(
        'c.productCount',
        'c.products',
        'p',
        (qb) => qb.where('p.isActive = true'),
      )
      .getOne();
    if (!category) throw new NotFoundException('Danh mục không tồn tại');
    return category;
  }

  async create(dto: CreateCategoryDto) {
    const category = this.categoryRepo.create(dto);
    return this.categoryRepo.save(category);
  }

  async update(dto: UpdateCategoryDto) {
    const category = await this.categoryRepo.findOneBy({ id: dto.id });
    if (!category) throw new NotFoundException('Danh mục không tồn tại');
    Object.assign(category, dto);
    return this.categoryRepo.save(category);
  }

  async delete(id: string) {
    const category = await this.categoryRepo.findOne({
      where: { id },
      relations: ['products'],
    });
    if (!category) throw new NotFoundException('Danh mục không tồn tại');
    if (category.products && category.products.length > 0) {
      throw new BadRequestException(
        'Không thể xóa danh mục đang có sản phẩm',
      );
    }
    await this.categoryRepo.remove(category);
    return null;
  }
}
