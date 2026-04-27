

export class UpdateRollDto {
  private constructor(
    public id: string,
    public roll: string,
    
    public updatedAt?: Date
  ) {}

  get values() {
    const obj: { [key: string]: any } = {};

    if (this.roll) obj.roll = this.roll;
    
   

    return obj;
  }

  static create(obj: { [key: string]: any }): [string?, UpdateRollDto?] {
    const {
      id, roll, updatedAt 

      
     
    } = obj;

    //if (!UUIDValidator.isValidUUID(id)) return ['no es un id valido!!'];

    let newUpdatetedAt = updatedAt;
    if (updatedAt) {
      newUpdatetedAt = new Date(updatedAt);
      if (newUpdatetedAt.toString() === 'Invalid Date') {
        return ['CompletedAt must be a valid date'];
      }
    }
    return [
      undefined,
      new UpdateRollDto(
        id,
       roll,
       
       newUpdatetedAt
        
      ),
    ];
  }
}
