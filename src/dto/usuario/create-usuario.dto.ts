import { ValidatorEmail } from "../../config/validar.email";

export class RegisterUserDto {
  private constructor(
    public id: string,
    public nombre: string,

    public email: string,
    public password: string,
    public cedula: string,
    public celular: string,
    public direccion: string,
    public rollId: string,

    public img: string,
    public activo: boolean,
    public emailValidate: boolean,
    public autenticado: boolean,
    public biografia?: string,
    public slug?: string,
    public configuracionId?: string,
    public createdAt?: Date,
    public updatedAt?: Date
  ) {}

  static create(obj: { [key: string]: any }): [string?, RegisterUserDto?] {
    const {
      id,
      nombre,
      email,
      password,
      cedula,
      celular,
      direccion,
      rollId,

      img,
      activo,
      emailValidate,
      utenticado,
      biografia,
      slug,
      configuracionId,
      createdAt,
      updatedAt,
    } = obj;

    if (!nombre) return ["el nombre es obligatorio"];
    if (!email) return ["el email el obligatorio"];
    if (!ValidatorEmail.validate(email)) return ["el email no es valido"];
    if (!password) return ["la contraseña es obligatorio"];
    if (password.length < 6)
      return ["la contraseña debe tener minimo 6 caracteres"];
    if (!cedula) return ["el numero de cedula o ruc cedula"];
    if (!celular) return ["el numero de teléfono es requerido"];

    return [
      undefined,
      new RegisterUserDto(
        id,
        nombre,
        email,
        password,
        cedula,
        celular,
        direccion,
        rollId,

        img,
        activo,
        emailValidate,
        utenticado,
        biografia,
        slug,
        configuracionId,
        createdAt ?? new Date(),
        updatedAt ?? new Date()
      ),
    ];
  }
}
