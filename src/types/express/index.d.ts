import { UserEntity } from "../../entity/usuario/user.entity";
import { File as MulterFile } from "multer";

declare global {
  namespace Express {
    interface Request {
      usuario?: UserEntity;
      file?: MulterFile;
      files?: MulterFile[];
    }
  }
}

export {};
