import { Request, Response } from "express";
import { AuthService } from "./service/usuario.service";
import { CustomError } from "../../error/custom.error";
import { RegisterUserDto } from "../../dto/usuario/create-usuario.dto";
import { UpdateUserDto } from "../../dto/usuario/update-usuario.dto";
import { LoginUserDto } from "../../dto/usuario/login-usuario.dto";
import { JwtAdapter } from "../../config/jwt.adapter";
import { UsuarioEntity } from "../../entity/usuario/usuario.entity";

export class AuthController {
  constructor(public readonly authService: AuthService) {}

  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    console.log(`${error}`);
    return res.status(500).json({ error: "Internal server error" });
  };

  create = (req: Request, res: Response) => {
    const body = req.body;

    console.log("usuario", body);

    const [error, registerDto] = RegisterUserDto.create(body);
    if (error) return res.status(400).json({ error });
    this.authService
      .registerUser(registerDto!, req.body.usuario)
      .then((user) => res.json(user))
      .catch((error) => this.handleError(error, res));
  };

  getUser = async (req: Request, res: Response) => {
    // const {page = 1, limit = 10} = req.query

    //const [error, paginationDto] = PaginationDto.create(+page, +limit)
    //if(error) return res.status(400).json({error})

    this.authService
      .getUser(req.body.usuario)
      .then((user) => res.json(user))
      .catch((err) => this.handleError(err, res));
  };
  getUserNombre = async (req: Request, res: Response) => {
    const nombre = decodeURIComponent(req.params.nombre);

    this.authService
      .getUserNombre(nombre)
      .then((user) => res.json(user))

      .catch((err) => this.handleError(err, res));
  };

  getUsuarioEmpleado = (req: Request, res: Response) => {
    const usuario: UsuarioEntity = req.body.usuario;

    if (!usuario) {
      return res
        .status(400)
        .json({ error: "Usuario no encontrado en la solicitud" });
    }
    this.authService
      .getUsuarioEmpleado(req.body.usuario)
      .then((emlpeado) => res.status(200).json(emlpeado))
      .catch((error) => this.handleError(error, res));
  };

  getUsuarioCliente = (req: Request, res: Response) => {
    const usuario: UsuarioEntity = req.body.usuario;

    if (!usuario) {
      return res
        .status(400)
        .json({ error: "Usuario no encontrado en la solicitud" });
    }
    this.authService
      .getUsuarioCliente(req.body.usuario)
      .then((cliente) => res.status(200).json(cliente))
      .catch((error) => this.handleError(error, res));
  };

  putUser = (req: Request, res: Response) => {
    const usuario: UsuarioEntity = req.body.usuario;

    if (!usuario) {
      return res
        .status(400)
        .json({ error: "Usuario no encontrado en la solicitud" });
    }
    const { id } = req.params;
    const [error, updateUserDto] = UpdateUserDto.create({ ...req.body, id });
    if (error) return res.status(400).json(error);

    this.authService
      .putUsuario(id, req.body.usuario, updateUserDto!)
      .then((user) => res.status(200).json(user))
      .catch((error) => this.handleError(error, res));
  };

  deleteUser = async (req: Request, res: Response) => {
    this.authService.deleteAllservicio().then((dele) => res.json(dele));
    console.log(process.env.NODE_ENV);
  };

  login = (req: Request, res: Response) => {
    const body = req.body;
    console.log("con", body);

    const [error, loginUserDto] = LoginUserDto.create(body);
    if (error) return res.status(400).json({ error });
    this.authService
      .loginUser(loginUserDto!)
      .then((login) => res.json(login))

      .catch((error) => this.handleError(error, res));
  };

  validateEmail = (req: Request, res: Response) => {
    const { token } = req.params;

    this.authService
      .validateEmail(token)
      .then(() => res.json("Email validado"))
      .catch((error) => this.handleError(error, res));
  };

  revalidarToken = async (req: Request, res: Response) => {
    console.log("el resivido el mensaje");

    // Generar JWT
    const token = await JwtAdapter.generarToken({ id: req.body.usuario.id });
    console.log("toc", token);

    res.json({
      usuario: req.body.usuario,
      token,
      ok: "mensaje",
    });
    console.log(token);
  };

  updatePassword = (req: Request, res: Response) => {
    const { id } = req.params;
    const { oldPassword, newPassword } = req.body;

    this.authService
      .updatePassword(id, oldPassword, newPassword)
      .then((password) => res.json(password))
      .catch((error) => this.handleError(error, res));
  };

  getUsuarioPermisos = async (req: Request, res: Response) => {
    const { id } = req.params;

    this.authService
      .getUsuarioPermisos(id)
      .then((usuarioPermisos) => res.json(usuarioPermisos))
      .catch((err) => this.handleError(err, res));
  };
}
