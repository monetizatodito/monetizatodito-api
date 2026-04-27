import { CreateFacturaDto } from '../../dto/factura/create-factura.dto';
import { UserEntity } from '../../entity/usuario/user.entity';
import { FacturaRepository } from '../../repositorio/factura-repositorio';
import { ConfiguracionRepositorio } from '../../repositorio/configuracion.repositorio';
import { CustomError } from '../../error/custom.error';
import { validarIdUnico } from '../../config/generar-id';

export class FacturaService{

  private facturaRepositorio = new FacturaRepository()
  private configuracionRepositorio = new ConfiguracionRepositorio()

  public async createFactura(facturaDto: CreateFacturaDto, usuario: UserEntity){

    const config = await this.configuracionRepositorio.getConfiguracionId(usuario.id, usuario.configuracionId!)
    if (!config) throw CustomError.badRequest('tienes que configurar tu cuenta');
    const factura = await this.facturaRepositorio.create(facturaDto, usuario.id, config.id)
    return{
      msg: 'factura creada',
      factura
    }
    
  }



  public async getFactura(usuario: UserEntity){
    const factura = await this.facturaRepositorio.getFactura(usuario.id, usuario.configuracionId? usuario.configuracionId: '')
    return{factura}

  }


  public async getFacturaId(id: string, usuario: UserEntity){
    const idValido = validarIdUnico(id)
    if(!idValido){
      throw CustomError.badRequest('el id no es valido')
    }
    const factura = await this.facturaRepositorio.getFacturaId(id, usuario.id, usuario.configuracionId? usuario.configuracionId: '')
    if(!factura) throw CustomError.badRequest('no existe provedor con ese id')
    return{factura}

  }

 


  public async deleteFatura(id: string, usuario: UserEntity){
    const idValido = validarIdUnico(id)
    console.log('idddd',id)
    if(!idValido){
      throw CustomError.badRequest('el id no es valido')
    }
    const provedor = await this.facturaRepositorio.deleteFactura(id, usuario.id, usuario.configuracionId? usuario.configuracionId: '')
    return{msg: 'provedor eliminado', provedor}

  }
}