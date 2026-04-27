import { validarIdUnico } from "../../config/generar-id";

export class UpdateUserDto {
  private constructor(
    public id: string,
    public nombre: string,
    public email: string,
    public password: string,
    public cedula: string,
    public celular: string,
    public direccion: string,
    public rollId: string,

    public activo: boolean,
    public autenticado: boolean,
    public emailValidate: boolean,
    public biografia?: string,
    public slug?: string,
    public img?: string,
    public updatedAt?: Date
  ) {}

  get values() {
    const obj: { [key: string]: any } = {};

    if (this.nombre) obj.nombre = this.nombre;
    if (this.email) obj.email = this.email;
    if (this.password) obj.password = this.password;
    if (this.cedula) obj.cedula = this.cedula;
    if (this.celular) obj.celular = this.celular;
    if (this.direccion) obj.direccion = this.direccion;
    if (this.rollId) obj.rollId = this.rollId;
    if (this.slug) obj.slug = this.slug;
    if (this.activo) obj.activo = this.activo;
    if (this.autenticado) obj.autenticado = this.autenticado;
    if (this.emailValidate) obj.emailValidate = this.emailValidate;
    if (this.img) obj.img = this.img;
    if (this.updatedAt) obj.updatedAt = this.updatedAt;

    return obj;
  }

  static create(obj: { [key: string]: any }): [string?, UpdateUserDto?] {
    const {
      id,
      nombre,
      email,
      password,
      cedula,
      celular,
      direccion,
      rollId,

      activo,
      autenticado,
      emailValidate,
      biografia,
      slug,
      updatedAt,
    } = obj;
    if (!validarIdUnico(id)) return ["no es un id valido"];

    let newUpdatetedAt = updatedAt;
    if (updatedAt) {
      newUpdatetedAt = new Date(updatedAt);
      if (newUpdatetedAt.toString() === "Invalid Date") {
        return ["CompletedAt must be a valid date"];
      }
    }

    return [
      undefined,
      new UpdateUserDto(
        id,
        nombre,
        email,
        password,
        cedula,
        celular,
        direccion,
        rollId,

        activo,
        autenticado,
        emailValidate,
        biografia,
        slug,
        newUpdatetedAt
      ),
    ];
  }
}
