export class PasswordValidator {
  static get password() {
    // La contraseña debe tener al menos 8 caracteres, incluyendo al menos un número, una letra mayúscula, una minúscula y un carácter especial
    return new RegExp(
      "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*])[A-Za-z\\d!@#$%^&*]{8,}$",
    );
  }

  static validate(password: string): boolean {
    return this.password.test(password);
  }
}
