

export class UpdatePlanesDto {
    private constructor(
      public id: string,
      public titulo: string,
      public precio: number,
      public descripcion: string,
      public configuracionId: string,
      public updatedAt?: Date,
     
      
     
     
    ) {}
  
    get values() {
      const obj: { [key: string]: any } = {};
  
      if (this.titulo) obj.titulo = this.titulo;
      if (this.precio) obj.precio = this.precio;
      if(this.descripcion) obj.descripcion = this.descripcion;
      if (this.updatedAt) obj.updatedAt = this.updatedAt;
      
  
      return obj;
    }
  
    static create(obj: { [key: string]: any }): [string?, UpdatePlanesDto?] {
      const {
        id,
       titulo,
       precio,
       descripcion,
       configuracionId,
       updatedAt,
       
      } = obj;
  
     
      let newUpdatetedAt = updatedAt;
      if (updatedAt) {
        newUpdatetedAt = new Date(updatedAt);
        if (newUpdatetedAt.toString() === 'Invalid Date') {
          return ['CompletedAt must be a valid date'];
        }
      }
      return [
        undefined,
        new UpdatePlanesDto(
        id,
       titulo,
        precio,
        descripcion,
        configuracionId,
        newUpdatetedAt,
         
        ),
      ];
    }
  }
  