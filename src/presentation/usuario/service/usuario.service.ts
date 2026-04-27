import { config } from "dotenv";
import { bcryptAdapter } from "../../../config/bcrypt.adapter";
import { envs } from "../../../config/envs";
import { validarIdUnico } from "../../../config/generar-id";
import { JwtAdapter } from "../../../config/jwt.adapter";
import { RegisterUserDto } from "../../../dto/usuario/create-usuario.dto";
import { LoginUserDto } from "../../../dto/usuario/login-usuario.dto";
import { UpdateUserDto } from "../../../dto/usuario/update-usuario.dto";
import { UsuarioEntity } from "../../../entity/usuario/usuario.entity";
import { CustomError } from "../../../error/custom.error";
import { ConfiguracionRepositorio } from "../../../repositorio/configuracion.repositorio";
import { UsuarioRepository } from "../../../repositorio/usuario.repositorio";
import { EmailService } from "./email.service";

import { RollRepository } from "../../../repositorio/roll.repositorio";
import { generarSlugAuthUnico } from "../../../util/slugify";

export class AuthService {
  constructor(private readonly emailService: EmailService) {}
  private usuarioRepositorio = new UsuarioRepository();
  private configuracionRepositorio = new ConfiguracionRepositorio();
  private rollRepositorio = new RollRepository();

  public async registerUser(
    registerDto: RegisterUserDto,
    usuario: UsuarioEntity
  ) {
    const [config, existeUser] = await Promise.all([
      this.configuracionRepositorio.getConfiguracionId(
        usuario.id,
        usuario.configuracionId!
      ),
      this.usuarioRepositorio.emailExists(registerDto.email),
    ]);

    // if (!config) {
    // throw CustomError.badRequest(
    ("Tienes que configurar tu cuenta antes de realizar este proceso");
    // );
    //  }
    if (existeUser) {
      throw CustomError.badRequest("Ya existe un usuario con ese email");
    }

    registerDto.password = bcryptAdapter.hash(registerDto.password);

    let rolesPermitidos: string[] = [];

    const roll = await this.rollRepositorio.getRollId(usuario.rollId);

    switch (roll.roll) {
      case "empleado":
        rolesPermitidos = ["usuario"];
        break;
      case "cliente":
      case "admin":
        rolesPermitidos = ["admin", "empleado", "contador"];
        break;
      case "empresa":
      case "empresa-admin":
        // Permitir que 'empresa' y 'empresa-admin' creen usuarios con rol 'cliente'
        rolesPermitidos = [
          "cliente",
          "empresa",
          "empresa-admin",
          "usuario",
          "contador",
          "empleado",
        ];
        break;
      default:
        throw CustomError.badRequest("Rol no válido");
    }

    const verificarRoll = await this.rollRepositorio.getRollId(
      registerDto.rollId
    );

    // Validar el rol y crear el usuario
    if (!rolesPermitidos.includes(verificarRoll.roll)) {
      throw CustomError.internalServerError(
        `No puedes crear este roll: ${verificarRoll.roll}`
      );
    }

    // Enviar correo solo si el rol del nuevo usuario es 'cliente'
    if (verificarRoll.roll === "cliente") {
      const user = await this.crearUsuario(registerDto);
      const token = await this.generarTokenUsuario(user);
      await this.sendEmailValidateLink(user.email, user.nombre);
      return { user, token };
    } else {
      const user = await this.crearUsuario(registerDto, config.id!);
      const token = await this.generarTokenUsuario(user);
      return { user, token };
    }
  }

  private async crearUsuario(registerDto: RegisterUserDto, configId?: string) {
    registerDto.slug = await generarSlugAuthUnico(registerDto.nombre);
    try {
      return await this.usuarioRepositorio.createUsuario(
        registerDto,
        configId ? configId : ""
      );
    } catch (error) {
      throw CustomError.internalServerError(`${error}`);
    }
  }

  private async generarTokenUsuario(user: UsuarioEntity) {
    try {
      const token = await JwtAdapter.generarToken({
        id: user.id,
        rol: user.rol,
      });
      if (!token)
        throw CustomError.internalServerError("No se pudo generar el token");
      return token;
    } catch (error) {
      throw CustomError.internalServerError(`${error}`);
    }
  }

  async getUser(user: UsuarioEntity) {
    console.log("user", user);
    const usuario = await this.usuarioRepositorio.getUsuario();
    return usuario;
  }

  async getUserNombre(nombre: string) {
    console.log("user", nombre);
    const usuario = await this.usuarioRepositorio.getUserByNombre(nombre);
    return usuario;
  }

  async getUsuarioEmpleado(usuario: UsuarioEntity) {
    const config = await this.configuracionRepositorio.getConfiguracionId(
      usuario.id,
      usuario.configuracionId!
    );

    if (!usuario || !usuario.id) {
      throw new Error("Usuario no válido");
    }

    const empleado = await this.usuarioRepositorio.getUsuarioEmpleado(
      usuario.configuracionId ? usuario.configuracionId : config.id
    );
    return { empleado };
  }

  async getUsuarioCliente(usuario: UsuarioEntity) {
    const config = await this.configuracionRepositorio.getConfiguracionId(
      usuario.id,
      usuario.configuracionId!
    );

    if (!usuario || !usuario.id) {
      throw new Error("Usuario no válido");
    }

    const cliente = await this.usuarioRepositorio.getUsuarioCliente();
    return { cliente };
  }

  public async loginUser(loginUserDto: LoginUserDto) {
    const user = await this.usuarioRepositorio.login(loginUserDto.email);
    if (!user)
      throw CustomError.badRequest("No existe un usuario con esa cuenta");

    if (user.emailValidate === false)
      throw CustomError.unAuthorized("Tu email no ha sido confirmado!!!");

    const existPassword = bcryptAdapter.compare(
      loginUserDto.password,
      user.password
    );
    console.log("¿Contraseña válida?", existPassword);

    if (!existPassword)
      throw CustomError.unAuthorized("La contraseña no es válida!!");

    const token = await JwtAdapter.generarToken({
      id: user.id,
      email: user.email,
    });

    if (!token)
      throw CustomError.internalServerError("Hable con el administrador");

    return {
      usuario: user,
      token,
    };
  }

  private sendEmailValidateLink = async (email: string, nombre: string) => {
    const token = await JwtAdapter.generarToken({ email });
    if (!token)
      throw CustomError.internalServerError("no se pudogenerar el token");
    const link = `${envs.WEBSERVICE_URL}/auth/validate-email/${token}`;

    console.log(link);
    const html = `
            <h1>hola, ${nombre}: valida tu correo electronico</h1>
            <p>has click en el siguiente enlace</p>
            <a href="${link}">validar email</a>
        `;
    const options = {
      to: email,
      subject: "validar email",
      htmlBody: html,
    };

    const isSet = await this.emailService.sendEmail(options);
    if (!isSet) throw CustomError.internalServerError("no se envio tu correo");

    return true;
  };

  public validateEmail = async (token: string): Promise<boolean> => {
    const payload = await JwtAdapter.validarToken(token);
    if (!payload) throw CustomError.unAuthorized("Invalid token");

    const { email } = payload as { email: string };
    if (!email) throw CustomError.internalServerError("Email not in token");

    // Verifica si el email existe
    const user = await this.usuarioRepositorio.getUserByEmail(email);
    if (!user) throw CustomError.internalServerError("Email does not exist");

    // Obtiene el usuario por ID
    const usuario = await this.usuarioRepositorio.getUsuarioId(user.id);
    if (!usuario) throw CustomError.internalServerError("User not found");

    const updateResult = await this.usuarioRepositorio.updateUsuario(user.id, {
      emailValidate: true,
    });
    console.log("update", updateResult);
    if (!updateResult)
      throw CustomError.internalServerError("Could not update user");

    return true;
  };

  public async putUsuario(
    id: string,
    usuario: UsuarioEntity,
    updateUserDto: UpdateUserDto
  ) {
    if (!validarIdUnico(id)) throw CustomError.badRequest("id no es valido");
    const idCheckPromise = this.usuarioRepositorio.getUsuarioId(id);
    console.log("use", usuario);

    // Si el email está presente, verificar si ya está en uso por otro usuario (excluyendo al usuario actual por su ID)
    const emailCheckPromise = updateUserDto.email
      ? this.usuarioRepositorio.getUsuarioEmail(updateUserDto.email, id)
      : Promise.resolve(null);

    const [idExists, emailInUse] = await Promise.all([
      idCheckPromise,
      emailCheckPromise,
    ]);

    if (!idExists)
      throw CustomError.badRequest("No existe un usuario con ese ID");

    // Si el email está en uso por otro usuario, lanzar el error
    if (emailInUse) {
      throw CustomError.badRequest("El email ya está en uso por otro usuario");
    }

    // Llamar al repositorio para actualizar el usuario

    let rolesPermitidos: string[] = [];
    const verificarRoll = await this.rollRepositorio.getRollId(
      updateUserDto.rollId
    );

    switch (verificarRoll.roll) {
      case "empleado":
        rolesPermitidos = ["usuario"];
        break;
      case "cliente":
      case "admin":
        rolesPermitidos = ["admin", "empleado", "contador"];
        break;
      case "empresa":
      case "empresa-admin":
        // Permitir que 'empresa' y 'empresa-admin' creen usuarios con rol 'cliente'
        rolesPermitidos = [
          "cliente",
          "empresa",
          "empresa-admin",
          "usuario",
          "contador",
          "empleado",
        ];
        break;
      default:
        throw CustomError.badRequest("Rol no válido");
    }

    // Validar el rol y crear el usuario
    if (!rolesPermitidos.includes(verificarRoll.roll)) {
      throw CustomError.internalServerError(
        `No puedes actualizar este roll: ${verificarRoll.roll}`
      );
    }

    // Enviar correo solo si el rol del nuevo usuario es 'cliente'

    const user = await this.usuarioRepositorio.updateUsuario(id, updateUserDto);
    if (!user) throw CustomError.badRequest("El usuario no existe");

    if (verificarRoll.roll === "cliente") {
      await this.sendEmailValidateLink(user.email, user.nombre);
    }
    return { user };
  }

  async deleteAllservicio() {
    //    if (process.env.NODE_ENV === 'development') {
    //      return {
    //        msg: 'no puedes eliminar estoy en desarrollo',
    //      };
    //    }
    //    const query =
    //      AppDataSource.getRepository(ModelUsuario).createQueryBuilder('usuario');
    //    try {
    //      return await query.delete().where({}).execute();
    //    } catch (error) {
    //      console.log(error);
    //    }
  }

  public async logout(loginUserDto: LoginUserDto) {
    // const user = await AppDataSource.getRepository(ModelUsuario).findOne({
    //   where: { email: loginUserDto.email },
    // });
    // user!.autenticado = false;
    // const { password, ...usuario } = UserEntity.fromJson(user!);
    // return {
    //   msg: 'cesion cerrada',
    //   usuario,
    // };
  }

  async updatePassword(
    id: string,
    oldPassword: string,
    newPassword: string
  ): Promise<any> {
    // Obtener el usuario
    const user = await this.usuarioRepositorio.getUsuarioId(id);
    if (!user) {
      throw CustomError.badRequest("Usuario no encontrado");
    }

    // Verificar la contraseña actual
    const isMatch = bcryptAdapter.compare(oldPassword, user.password);
    if (!isMatch) {
      throw CustomError.badRequest("La contraseña actual es incorrecta");
    }

    // Encriptar la nueva contraseña
    const hashedNewPassword = bcryptAdapter.hash(newPassword);

    // Actualizar la contraseña
    const updatedUser = await this.usuarioRepositorio.updatePassword(
      id,
      hashedNewPassword
    );
    if (!updatedUser) {
      throw CustomError.badRequest("No se pudo actualizar la contraseña");
    }

    return {
      msg: "contraseña actualizada correctamente",
    };
  }

  public async getUsuarioPermisos(usuarioId: string) {
    const usuarioPrmisos =
      await this.usuarioRepositorio.getUsuarioPermisos(usuarioId);
    return { usuarioPrmisos };
  }
}
