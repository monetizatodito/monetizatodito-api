export class UsuarioEntity {
  id: string;
  nombre: string;
  email: string;
  password: string;
  cedula: string;
  celular: string;
  direccion: string;
  rollId: string;
  slug?: string;
  rol?: string;
  img?: string;
  activo: boolean;
  emailValidate: boolean;
  biografia?: string;
  autenticado: boolean;
  configuracionId?: string | null;

  createdAt?: Date;
  updatedAt?: Date;
}
