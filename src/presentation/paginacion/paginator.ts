export interface PaginationParams {
  page?: number | string;
  limit?: number | string;
}

export interface PaginationMeta {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export class Paginator {
  public page: number;
  public limit: number;
  public offset: number;

  constructor({ page = 1, limit = 10 }: PaginationParams) {
    this.page = this.parsePositiveInt(page, 1);
    this.limit = this.parsePositiveInt(limit, 10);
    this.offset = (this.page - 1) * this.limit;
  }

  private parsePositiveInt(
    value: number | string,
    defaultValue: number
  ): number {
    const parsed = parseInt(value as string, 10);
    return isNaN(parsed) || parsed < 1 ? defaultValue : parsed;
  }

  getMeta(totalItems: number): PaginationMeta {
    const totalPages = Math.ceil(totalItems / this.limit);
    return {
      totalItems,
      totalPages,
      currentPage: this.page,
      pageSize: this.limit,
      hasNextPage: this.page < totalPages,
      hasPrevPage: this.page > 1,
    };
  }
}
