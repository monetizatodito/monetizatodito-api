//import { CreateFacturaDto } from "../factura/create-factura.dto";
//import { CreateProvedorDto } from "../provedores/create-provedores.dto";

export class CreateProductoDto {
  private constructor(
    public id: string,
    public codigoB: string,
    public nombre: string,
    public categoria: string,
    public configuracionId?: string,
    public descripcion?: string,
    public createdAt?: Date,
    public activo?: boolean,
   
    
   
    public images?: string
  ) {
    //public codigoB?: string,
  }

  static create(obj: { [key: string]: any }): [string?, CreateProductoDto?] {
    const {
      id,
      codigoB,
      nombre,
      categoria,
      
     
      configuracionId,
      descripcion,
      createdAt,
      iva,
      cantidad,
      //ok,
      ice,
      lote,
      images,
    } = obj;

    if (!nombre) return ['el nombre es obligatorio'];
    
    return [
      undefined,
      new CreateProductoDto(
        id,
        codigoB,
        nombre,
        categoria,
      
        configuracionId,
        descripcion,
        createdAt ?? new Date(),
       
        cantidad,
        //ok,
        
        images
      ),
    ];
  }
}
