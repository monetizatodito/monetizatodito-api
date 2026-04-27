import { CustomError } from "../../error/custom.error";

export class UserEntity {
  constructor(
    public id: string,
    public nombre: string,
    public email: string,
    public password: string,
    public cedula: string,
    public celular: string,
    public direccion: string,

    public biografia?: string,
    public slug?: string,
    public emailValidate?: boolean,
    public activo?: boolean,
    public img?: string,
    public configuracionId?: string,
    public autenticado?: boolean,
    public createdAt?: Date
  ) {}

  static fromJson(obj: { [key: string]: any }) {
    const {
      id,
      nombre,
      email,
      password,
      cedula,
      celular,
      direccion,

      img,
      activo,
      emailValidate,
      biografia,
      slug,
      configuracionId,
      autenticado,
      createdAt,
    } = obj;

    if (!nombre) throw CustomError.badRequest("missing nombre!!!!");
    if (!email) throw CustomError.badRequest("missing email");
    if (!password) throw CustomError.badRequest("missing contraseña");
    if (!cedula) throw CustomError.badRequest("missing cedula");
    if (!celular) throw CustomError.badRequest("missing celular");
    if (!direccion) throw CustomError.badRequest("missing direccion");
    if (emailValidate === undefined)
      throw CustomError.badRequest("missing emailValidate");

    return new UserEntity(
      id,
      nombre,
      email,
      password,
      cedula,
      celular,
      direccion,

      img,
      activo,
      emailValidate,
      biografia,
      slug,
      configuracionId,
      autenticado,
      createdAt
    );
  }
}
