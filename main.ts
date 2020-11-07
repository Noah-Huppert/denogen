import { exists as fsExists } from "https://deno.land/std@0.76.0/fs/mod.ts";
import { parse as parseFlags } from "https://deno.land/std/flags/mod.ts";
import { parse as parseTs } from "https://github.com/nestdotland/deno_swc/raw/master/mod.ts";
import {
  ModuleItem,
  Program,
  Statement,
  TsInterfaceDeclaration,
  TsKeywordType,
} from "https://github.com/nestdotland/deno_swc/raw/master/types/options.ts";

// Parse files and generate guards
/**
 * Metadata regarding an interface definition which will be relevant to type
 * guard generation.
 */
export interface InterfaceDef {
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
export interface InterfaceProp {
  /**
	* Declared name of property.
	*/
  name: string;

  /**
	* Kind if available.
	*/
  kind?: string;
}

/**
 * Holds a Typescript SWC AST and the associated interfaces. For use in the 
 * Interface.FromSrc() function.
 */
interface SrcInterfaceCollection {
  /**
   * Source code SWC AST.
   */
  ast: ModuleItem[] | Statement[];

  /**
   * Parsed interfaces.
   */
  interfaces: Interface[];
}

/**
 * Represents an interface for which to generate type guards. Provides functions
 * and methods for processing.
 */
export class Interface implements InterfaceDef {
  name: string;
  properties: InterfaceProp[];

  /**
	* Create an Interface from a TsInterfaceDeclaration SWC AST node.
	* @param node SWC AST node from which to create the Interface.
	* @throws {string} If node cannot be used to create an Interface.
	*/
  constructor(node: TsInterfaceDeclaration) {
    // Set the interface name
    this.name = node.id.value;

    // Parse properties
    this.properties = node.body.body.map((prop) => {
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

      if (prop.typeAnnotation !== null && prop.typeAnnotation !== undefined) {
        // What type of type annotation?
        const annotation = prop.typeAnnotation.typeAnnotation;

        if (annotation.type === "TsKeywordType") {
          // The compiler seems to think annotation could be a TsImportType
          // or a TsKeywordType even though the only type with
          // .type === "TsKeywordType" is a TsKeywordType so we will manually cast.
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
    });
  }

  /**
   * For an arbitrary SWC AST extract and return all Interface's. Only looks for
   * interfaces at the top level, not sure if interface declarations can be nested
   * in blocks but if they can this function won't find them.
   * @param nodes Abstract syntax tree from which to extract.
   * @returns All found interfaces.
   * @throws {string} If any found TsInterfaceDeclaration nodes are not sutable
   *     for interface construction.
   */
  static ExtractAll(nodes: ModuleItem[] | Statement[]): Interface[] {
    // Filter to only grab TsInterfaceDeclaration nodes
    // Typescript type narrowing doesn't work with [].filter() so we must do a
    // normal loop.
    let decls: TsInterfaceDeclaration[] = [];

    for (let i = 0; i < nodes.length; i++) {
      const item = nodes[i];

      if (item.type === "TsInterfaceDeclaration") {
        decls.push(item);
      }
    }

    // Parse declarations
    return decls.map((node) => {
      return new Interface(node);
    });
  }

  /**
   * For a piece of Typescript source code extract all interface's.
   * @param src Typescript source code text.
   * @returns All found interfaces.
   * @throws {string} If any found TsInterfaceDeclaration SWC AST nodes are not
   *     sutable for interface construction.
   */
  static FromSrc(src: string): SrcInterfaceCollection {
    // Parse Typescript into AST
    const ast = parseTs(src, {
      syntax: "typescript",
    });

    const nodes: (ModuleItem[] | Statement[]) = ast.body;

    // Extract interfaces
    const interfaces = Interface.ExtractAll(nodes);

    return {
      ast: nodes,
      interfaces: interfaces,
    };
  }
}

// If running in the command line
if (import.meta.main === true) {
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

  // Generate type guards
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
      const srcInterfaces = Interface.FromSrc(srcTxt);

      if (args.debug.indexOf("ast") !== -1) {
        console.log(fileName);
        console.log(JSON.stringify(srcInterfaces.ast, null, 4));
      }

      // Generate code
      return srcInterfaces.interfaces.map((def) => {
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
}
