import { validarIdUnico } from "../../config/generar-id";


import { UserEntity } from "../../entity/usuario/user.entity";
import { CustomError } from "../../error/custom.error";

import { ConfiguracionRepositorio } from "../../repositorio/configuracion.repositorio";
import { CreatePlanesDto } from '../../dto/planes/create-planes.dto';
import { PlanesRepository } from "../../repositorio/planes.repositorio";
import { UpdatePlanesDto } from "../../dto/planes/update-planes.entity";



export class PlanesService {
  private configuracionRepositorio = new ConfiguracionRepositorio()
  private planRepositorio = new PlanesRepository()
  constructor() {}

  public async createPlan(
    createPlanDto: CreatePlanesDto,
    usuario: UserEntity
  ) {



    const config = await this.configuracionRepositorio.getConfiguracionId(usuario.id, usuario.configuracionId!)
    if (!config) throw CustomError.badRequest('tienes que configurar tu cuenta');
        try {
            const  planes = await this.planRepositorio.create(createPlanDto, config.id)
           return {
                planes
      };
    } catch (error) {
      throw CustomError.internalServerError(`${error}`);
    }
  }

  public async getPlan(user: UserEntity) {
  const planes = await this.planRepositorio.getPlan()
  return{
    planes
  }
  }

  

  public async getPlanId(id: string) {
    const validId = validarIdUnico(id)
    if(!validId)throw CustomError.badRequest('el id no es valido')
    const plan = await this.planRepositorio.getPlanId(id)
    return{
        plan
    }
  }

  
  
  public async putPlan(
    id: string,
    usuario: UserEntity,
    updatePlanDto: UpdatePlanesDto
  ) {
    const validId = validarIdUnico(id)
    if(!validId)throw CustomError.badRequest('el id no es valido')

   
      const config = await this.configuracionRepositorio.getConfiguracionId(usuario.id, usuario.configuracionId!)
      if (!config) throw CustomError.badRequest('tienes que configurar tu cuenta');

     
        const plan = await this.planRepositorio.putPlan(id, updatePlanDto,)
            return{
              msg: 'el plan fue actualizado exitosamente',
              plan
            }
  }

  public async deletePlan(id: string) {
    const validId = validarIdUnico(id)
    if(!validId)throw CustomError.badRequest('el id no es valido')
        const plan = this.planRepositorio.deletePlan(id)
    return{
        msg: 'plan eliminado',
        plan
    }
  }
}
