export class CreatePlanesDto {
    constructor(
      public id: string,
      public titulo: string,
      public precio: number,
      public descripcion: string,
      
      public configuracionId: string,
      public activo?: boolean,
      public createdAt?: Date,
      public updatedAt?: Date
    ) {}
  
    static create(obj: { [key: string]: any }): [string?, CreatePlanesDto?] {
      const { id, titulo, precio, descripcion, onfiguracionId, activo, createdAt, updatedAt } = obj;
  
      if (!titulo) return ['debe fijarle un titulo'];
      if (!precio) return ['el precio es obligatorio'];
      if (!descripcion) return ['debe agregar una descripcion'];
  
      return [
        undefined,
        new CreatePlanesDto(
          id,
          titulo,
          precio,
          descripcion,
          onfiguracionId,
          activo,
          createdAt,
          updatedAt
        ),
      ];
    }
  }
  