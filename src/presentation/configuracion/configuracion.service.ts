import { CreateConfiguracionDto } from "../../dto/configuracion/create-configuracion.dto";
import { UserEntity } from "../../entity/usuario/user.entity";
import { CustomError } from "../../error/custom.error";
import { ConfiguracionRepositorio } from "../../repositorio/configuracion.repositorio";

import { config } from 'dotenv';
import { validarIdUnico } from '../../config/generar-id';

export class ConfiguracionService {
  private configuracionRepositorio = new ConfiguracionRepositorio();
  

  async createConfiguracion(
    createConfiguracionDto: CreateConfiguracionDto,
    usuario: UserEntity,
  ) {
    const configurado =
      await this.configuracionRepositorio.verificarConfiguracionExistente(
        usuario.id,
        usuario.configuracionId,
      );

      

    if (configurado)
      throw CustomError.badRequest("tu cuenta ya esta configurada");
    const config = await this.configuracionRepositorio.createConfiguracion(
      createConfiguracionDto,
      usuario.id,
    );
    const secuenciaNum = Number(config.numeroF)
    
    return {
      config,
    };
  }

  public async getConfiguracionId(id: string) {
    const validId = validarIdUnico(id)
    if(!validId)throw CustomError.badRequest('el id no es valido')
    const config = await this.configuracionRepositorio.getConfiguracionId(id)
    return{
        config
    }
  }


  async getConfiguracion(user: UserEntity) {
      const configuracion = await this.configuracionRepositorio.getConfiguracion(user.id, user.configuracionId? user.configuracionId: '')
      console.log('con', configuracion)
      return {configuracion}
  }
}
