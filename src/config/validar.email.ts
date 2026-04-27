//export class validatorEmail {
//    static get email() {
//      return new RegExp('^[^@]+@[^@]+.[a-zA-Z]{2,}$');
//    }
//  }

export class ValidatorEmail {
  static get email() {
    return new RegExp("^[^@\\s]+@[^@\\s]+\\.[a-zA-Z]{2,}$");
  }

  static validate(email: string): boolean {
    return this.email.test(email);
  }
}
