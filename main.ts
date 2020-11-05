import { exists as fsExists } from "https://deno.land/std@0.76.0/fs/mod.ts";
import { parse as parseFlags } from "https://deno.land/std/flags/mod.ts";
import { parse as parseTs } from "https://github.com/nestdotland/deno_swc/raw/master/mod.ts";
import {
  ModuleItem,
  Statement,
  TsInterfaceDeclaration,
  TsKeywordType,
} from "https://github.com/nestdotland/deno_swc/raw/master/types/options.ts";

// Parse command line arguments
const args = parseFlags(Deno.args, {
  alias: {
    "h": "help",
    "f": "file",
    "o": "output",
    "d": "debug",
  },
  default: {
    "output": "<FILE>-guard.ts",
    "debug": [],
  },
});

if (args.help === true) {
  console.log(`deno-guard - automatically generates Typescript guards

USAGE

    deno-guard [-h,--help] -f,--file FILE -o,--output OUT_PATTERN -d,--debug DEBUG

OPTIONS

    -h,--help      Show help text.
    -f,--file      Input source files. Can be specified multiple times.
    -o,--output    Pattern for output file names. The string '<FILE>' will be 
                   replaced by the name of the input file without extension.
    -d,--debug     Debug options, used mainly for development. Can be specified
                   multiple times. Only accepts the following: 'ast' (prints each
                   source file's AST to stdout).

BEHAVIOR

    Generates Typescript guards for all interfaces in the specified file.
    The checker will be a function who's name is: "is<Type name>" where the first
    letter of the type name is capitalized.
`);
  Deno.exit(0);
}

if (typeof args.file === "string") {
  args.file = [args.file];
}

if (args.file === undefined || args.file.length === 0) {
  console.error("At least one file must be specified via the -f FILE flag.");
  Deno.exit(1);
}

let lostFiles: string[] = await Promise.all(args.file
  .map(async (filePath: string) => {
    if (await fsExists(filePath) === false) {
      return filePath;
    }
  }));
lostFiles = lostFiles.filter((v: string) => v !== undefined);

if (lostFiles.length > 0) {
  console.error(`Input file(s) not found: ${lostFiles.join(",")}`);
  Deno.exit(1);
}

if (typeof args.debug === "string") {
  args.debug = [args.debug];
}

// Parse files and generate guards
/**
 * Metadata regarding an interface definition which will be relevant to type
 * guard generation.
 */
interface InterfaceDef {
  /**
	* Declared name of interface.
	*/
  name: string;

  /**
	* Defined properties.
	*/
  properties: InterfaceProp[];
}

/**
 * Metadata of an interface property which will be relevant to type 
 * guard generation.
 */
interface InterfaceProp {
  /**
	* Declared name of property.
	*/
  name: string;

  /**
	* Kind if available.
	*/
  kind?: string;
}

let guards: string[] = await Promise.all(
  args.file.map(async (fileName: string) => {
    // Read file
    let srcTxt = null;

    try {
      srcTxt = await Deno.readTextFile(fileName);
    } catch (e) {
      console.error(`Failed to open ${fileName}: ${e}`);
      Deno.exit(1);
    }

    // Parse interface declarations
    const parsed = parseTs(srcTxt, {
      syntax: "typescript",
    });

    if (args.debug.indexOf("ast") !== -1) {
      console.log(fileName);
      console.log(JSON.stringify(parsed, null, 4));
    }

    const parsedItems: (ModuleItem[] | Statement) = parsed.body;

    const parsedInterfaceDefs = parsedItems
      .filter((item): item is TsInterfaceDeclaration => {
        return item.type === "TsInterfaceDeclaration";
      });

    const defs: InterfaceDef[] = parsedInterfaceDefs.map((item) => {
      return {
        name: item.id.value,
        properties: item.body.body.map((prop) => {
          // Check is a property signature
          if (prop.type !== "TsPropertySignature") {
            throw `encountered a TsInterfaceBody item of type = '${prop.type}' but expected 'TsPropertySignature'`;
          }

          // Ensure we can get the property name
          if (prop.key.type !== "Identifier") {
            throw `encountered a TsPropertySignature with a key.type = ${prop.key.type} but expected 'Identifier'`;
          }

          // Get type of property if there is an annotation
          let kind = undefined;

          if (
            prop.typeAnnotation !== null &&
            prop.typeAnnotation !== undefined
          ) {
            // What type of type annotation?
            const annotation = prop.typeAnnotation.typeAnnotation;
            let kind = null;

            if (annotation.type === "TsKeywordType") {
              kind = (annotation as TsKeywordType).kind;
            } else {
              // Throw errors when we get a type we haven't accounted for
              // yet so we can add support in the future.
              throw `interface property type annotation type '${prop.typeAnnotation.type}' is not supported`;
            }
          }

          return {
            name: prop.key.value,
            kind: kind,
          };
        }),
      };
    });

    return defs.map((def) => {
      const guardName = `is${def.name[0].toUpperCase() + def.name.slice(1)}`;

      // For each type we will generate some custom code
      // Currently we only care about: https://github.com/nestdotland/deno_swc/blob/188fb2feb8d6c4f8a663d0f6d49b65f8b8956369/types/options.ts#L1778

      let checks = []; // Note: the order here matters

      return `\
/**
 * Ensures that value is a ${def.name} interface.
 * @param value To check.
 * @returns True if value is ${def.name}, false otherwise.
 */
function ${guardName}(value: unknown) value is ${def.name} {
  // TODO: Write type guards here
}
`;
    });
  }),
);

const enc = new TextEncoder();
guards.forEach((guard: string) => {
  Deno.stdout.write(enc.encode(guard.toString()));
});
