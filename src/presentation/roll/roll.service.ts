import { validarIdUnico } from '../../config/generar-id';
import { CreateRollDto } from '../../dto/roll/cearte-roll.dto';
import { UpdateRollDto } from '../../dto/roll/update-roll.dto';
import { UserEntity } from '../../entity/usuario/user.entity';
import { CustomError } from '../../error/custom.error';
import { ConfiguracionRepositorio } from '../../repositorio/configuracion.repositorio';
import { RollRepository } from '../../repositorio/roll.repositorio';

export class RollService{

  private rollRepositorio = new RollRepository()
  private configuracionRepositorio = new ConfiguracionRepositorio()

  public async createRoll(createRollDto: CreateRollDto, usuario: UserEntity){
   

    const roll = await this.rollRepositorio.create(createRollDto, )

    return{
      roll
    }


  }

  public async getRoll(){
    const roll = await this.rollRepositorio.getRoll()
    return{
      roll
    }
  }

  public async getRollId(id: string, usuario: UserEntity){

   
    const roll = await this.rollRepositorio.getRollId(id)

    return{
      roll
    }


  }

  public async putRoll(
    id: string,
    usuario: UserEntity,
    updateRollDto: UpdateRollDto,
  
) {
    const validId = validarIdUnico(id);
    if (!validId) throw CustomError.badRequest('El ID no es válido');

  
    
    
    const existeProvedor= await this.getRollId(id, usuario);
    if (!existeProvedor) throw CustomError.badRequest('El producto no existe');

    
    const roll = await this.rollRepositorio.putRoll(id, updateRollDto);

    // Registrar el movimiento en el kardex
    

    return {
        msg: 'roll actualizado correctamente',
        roll
    };
}


  public async rollDelete(id: string, usuario: UserEntity){

  
    const roll = await this.rollRepositorio.deleteRoll(id)

    return{
      roll
    }


  }
 public async asignarPrmiso(rollId: string, permiso: [], usuario: UserEntity){
  
  const permisos = await this.rollRepositorio.asignarPermiso(rollId, permiso)
  return {permiso}
 }

 public async getPermisoRoll(rollId: string, usuario: UserEntity){
 

  const permisosRoll = await this.rollRepositorio.getPermisoRoll(rollId)
  return {permisosRoll}
 }

 
}