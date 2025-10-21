const fs = require("fs");
const path = require("path");

const targetPathDev = path.join(
  __dirname,
  "../src/environments/environment.development.ts"
);
const targetPathProd = path.join(
  __dirname,
  "../src/environments/environment.ts"
);

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_KEY || "";

const contentDev = `export const environment = {
  production: false,
  SUPABASE_URL: "${supabaseUrl}",
  SUPABASE_KEY: "${supabaseKey}"
};
`;

const contentProd = `export const environment = {
  production: true,
  SUPABASE_URL: "${supabaseUrl}",
  SUPABASE_KEY: "${supabaseKey}"
};
`;

fs.writeFileSync(targetPathDev, contentDev);
fs.writeFileSync(targetPathProd, contentProd);

console.log("environment files generated");
