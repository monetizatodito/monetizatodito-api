export class UrlsDto {
  constructor(
    public id: string,
    public url_larga: string,
    public url_corta: string,
    public createdAt?: Date,
    public updatedAt?: Date
  ) {}

  static create(obj: { [key: string]: any }): [string?, UrlsDto?] {
    const { id, url_larga, url_corta, createdAt, updatedAt } = obj;

    if (!url_larga) return ['debe fijarle un titulo'];
    
    return [
      undefined,
      new UrlsDto(
        id,
        url_larga,
        url_corta,
        updatedAt ?? new Date(),
        createdAt ?? new Date(),
      ),
    ];
  }
}
