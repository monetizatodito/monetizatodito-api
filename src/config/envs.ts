import "dotenv/config";
import { get } from "env-var";

export const envs = {
  PORT: get("PORT").required().asPortNumber(),
  NODE_ENV: get("NODE_ENV").required().asString(),
  FIRMA_TOKEN: get("FIRMA_TOKEN").required().asString(),
  MAILER_SERVICE: get("MAILER_SERVICE").required().asString(),
  MAILER_EMAIL: get("MAILER_EMAIL").required().asString(),
  MAILER_SECRET_KEY: get("MAILER_SECRET_KEY").required().asString(),
  WEBSERVICE_URL: get("WEBSERVICE_URL").required().asString(),
  FRONTEND_URL: get("FRONTEND_URL").required().asString(),
  //db
  //DB_USERNAME: get('DB_USERNAME').required().asString(),
  //DB_DATABASE: get('DB_DATABASE').required().asString(),
  //DB_HOST: get('DB_HOST').required().asString(),
  //DB_PORT: get('DB_PORT').required().asPortNumber(),
  //DB_PASSWORD: get('DB_PASSWORD').required().asString(),
};
