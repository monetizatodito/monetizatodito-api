export class CreateRollDto {
  constructor(
    public id: string,
    public roll: string,
    public createdAt?: Date
  ) {}

  static create(obj: { [key: string]: any }): [string?, CreateRollDto?] {
    const { id, roll, createdAt } = obj;

    if (!roll) return ['debe ingresar un roll'];

    return [undefined, new CreateRollDto(id, roll, createdAt)];
  }
}