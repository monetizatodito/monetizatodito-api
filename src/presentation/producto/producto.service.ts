import { existsSync } from "fs";
import { validarIdUnico } from "../../config/generar-id";
import { CreateProductoDto } from "../../dto/producto/create-producto.dto";
import { UpdateProductoDto } from "../../dto/producto/update-producto.dto";
import { UserEntity } from "../../entity/usuario/user.entity";
import { CustomError } from "../../error/custom.error";
import { ConfiguracionRepositorio } from "../../repositorio/configuracion.repositorio";
import { ProductoRepository } from "../../repositorio/producto.rapositorio";



export class ProductoService {
  private configuracionRepositorio = new ConfiguracionRepositorio()
  private productoRepositorio = new ProductoRepository()
  
  constructor() {}

  public async createProducto(
    createProductoDto: CreateProductoDto,
    usuario: UserEntity
  ) {



    const config = await this.configuracionRepositorio.getConfiguracionId(usuario.id, usuario.configuracionId!)
    if (!config) throw CustomError.badRequest('tienes que configurar tu cuenta');
        try {
            const  producto = await this.productoRepositorio.create(createProductoDto, usuario.id, config.id)

          
           return {
                producto,
                usuarioId: usuario.id,
      };
    } catch (error) {
      throw CustomError.internalServerError(`${error}`);
    }
  }

  public async getProductos(user: UserEntity) {
  const producto = await this.productoRepositorio.getProducto(user.id, user.configuracionId)
  return{
    producto
  }
  }

  public async getProductoId(id: string) {
    const validId = validarIdUnico(id)
    if(!validId)throw CustomError.badRequest('el id no es valido')
    const producto = await this.productoRepositorio.getProductoId(id)
    return{
        producto
    }
  }

  
  
  public async putProducto(
    id: string,
    usuario: UserEntity,
    updateProductoDto: UpdateProductoDto,
    esAjuste: boolean = false // Parámetro para indicar si es un ajuste de stock
) {
    const validId = validarIdUnico(id);
    if (!validId) throw CustomError.badRequest('El ID no es válido');

    const config = await this.configuracionRepositorio.getConfiguracionId(usuario.id, usuario.configuracionId!)
    if (!config) throw CustomError.badRequest('tienes que configurar tu cuenta');
    
    const existeProducto = await this.productoRepositorio.getProductoId(id);
    if (!existeProducto) throw CustomError.badRequest('El producto no existe');

    if (esAjuste) {
        // Llamada al método de ajuste en caso de ser necesario
        return await this.ajustarProducto(id, usuario, updateProductoDto);
    }
    let productoUnidad = updateProductoDto.unidad
    // Lógica de actualización normal para compras (aumenta el stock)
    updateProductoDto.unidad = updateProductoDto.unidad + existeProducto.unidad;
    const producto = await this.productoRepositorio.putProducto(id, updateProductoDto, usuario.id, usuario.configuracionId || '');

    // Registrar el movimiento en el kardex
    
    
    return {
        msg: 'Producto actualizado correctamente',
        producto
    };
}

  public async deleteProducto(id: string) {
    const validId = validarIdUnico(id)
    if(!validId)throw CustomError.badRequest('el id no es valido')
        const producto = this.productoRepositorio.deleteProduct(id)
    return{
        msg: 'producto eliminado',
        producto
    }
  }

  

  // Método privado para manejar el ajuste de stock
private async ajustarProducto(
  id: string,
  usuario: UserEntity,
  updateProductoDto: UpdateProductoDto
) {
  const config = await this.configuracionRepositorio.getConfiguracionId(usuario.id, usuario.configuracionId!)
    if (!config) throw CustomError.badRequest('tienes que configurar tu cuenta');
  const existeProducto = await this.productoRepositorio.getProductoId(id);
  const nuevoStock = existeProducto.unidad + updateProductoDto.unidad;

  if (nuevoStock < 0) throw CustomError.badRequest('No se puede ajustar a una cantidad negativa');

  // Actualiza el stock en función del ajuste
  updateProductoDto.unidad = nuevoStock;
  const producto = await this.productoRepositorio.putProducto(id, updateProductoDto, usuario.id, usuario.configuracionId || '');

  // Determina si es un ajuste de entrada o salida y registra en el kardex
  const tipoMovimiento = updateProductoDto.unidad > existeProducto.unidad ? 'entrada' : 'salida';
  
 
  return {
      msg: 'Stock ajustado correctamente',
      producto
  };
}
}
