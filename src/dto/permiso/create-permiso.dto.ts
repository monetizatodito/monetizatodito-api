export class CreatePermisoDto {
  constructor(
    public id: string,
    public nombre: string,
    public descripcion: string,
    public usuarioId?: string,
   
    public createdAt?: Date,
    public updatedAt?: Date
  ) {}

  static create(obj: { [key: string]: any }): [string?, CreatePermisoDto?] {
    const { id, nombre, descripcion, avtivo, createdAt } = obj;

    if (!nombre) return ['debe ingresar un nombre tipo enlace ejemplo /admin/crear producto'];
    if (!descripcion) return ['debe ingresar un descripcion'];

    return [undefined, new CreatePermisoDto(id, nombre, descripcion, avtivo, createdAt)];
  }
}