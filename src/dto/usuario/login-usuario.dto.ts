import { ValidatorEmail } from "../../config/validar.email";

export class LoginUserDto {
  private constructor(
    public email: string,
    public password: string,
    public emailValidate?: boolean,
  ) {}

  static create(obj: { [key: string]: any }): [string?, LoginUserDto?] {
    const { email, password, emailValidate } = obj;

    if (!email) return ["el email el obligatorio"];
    if (!ValidatorEmail.validate(email)) return ["el email no es valido"];
    if (!password) return ["la contraseña es obligatorio"];
    if (password.length < 6)
      return ["la contraseña debe tener minimo 6 caracteres"];

    return [undefined, new LoginUserDto(email, password, emailValidate)];
  }
}
