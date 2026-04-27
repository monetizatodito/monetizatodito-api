import { validarIdUnico } from "../../config/generar-id";

export class ActualizarUsuarioDto {
  private constructor(
    public id: string,
    public nombre: string,
    public email: string,
    public password: string,
    public cedula: string,
    public celular: string,
    public direccion: string,

    public activo: boolean,
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

    if (typeof this.activo === "boolean") obj.activo = this.activo;
    if (typeof this.emailValidate === "boolean")
      obj.emailValidate = this.emailValidate;
    if (this.img) obj.img = this.img;
    if (this.updatedAt) obj.updatedAt = this.updatedAt;

    return obj;
  }

  static create(obj: {
    id: string;
    nombre: string;
    email: string;
    password: string;
    cedula: string;
    celular: string;
    direccion: string;

    activo: boolean;
    emailValidate: boolean;
    biografia?: string;
    slug: string;
    updatedAt?: string | Date;
    img?: string;
  }): [string?, ActualizarUsuarioDto?] {
    const {
      id,
      nombre,
      email,
      password,
      cedula,
      celular,
      direccion,

      activo,
      emailValidate,
      biografia,
      slug,
      updatedAt,
      img,
    } = obj;

    if (!validarIdUnico(id)) return ["ID no es válido"];

    let newUpdatedAt: Date | undefined = undefined;
    if (updatedAt) {
      newUpdatedAt = new Date(updatedAt);
      if (isNaN(newUpdatedAt.getTime())) {
        return ["updatedAt debe ser una fecha válida"];
      }
    }

    return [
      undefined,
      new ActualizarUsuarioDto(
        id,
        nombre,
        email,
        password,
        cedula,
        celular,
        direccion,

        activo,
        emailValidate,
        img,
        biografia,
        slug,

        newUpdatedAt
      ),
    ];
  }
}
