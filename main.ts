import { parse as parseFlags } from 'https://deno.land/std/flags/mod.ts';
import { parse as parseTs } from 'https://github.com/nestdotland/deno_swc/raw/master/mod.ts';
import {
    ModuleItem,
    Statement,
    TsKeywordType,
    TsInterfaceDeclaration,
} from 'https://github.com/nestdotland/deno_swc/raw/master/types/options.ts';

// Parse command line arguments
const args = parseFlags(Deno.args, {
    alias: {
	   'h': 'help',
	   'f': 'file',
	   'o': 'output',
    },
    default: {
	   'output': '<FILE>-guard.ts',
    },
});

if (args.help === true) {
    console.log(`deno-guard - automatically generates Typescript guards

USAGE

    deno-guard [-h,--help] -f,--file FILE... -o,--output OUT_PATTERN

OPTIONS

    -h,--help      Show help text.
    -f,--file      One or more input files.
    -o,--output    Pattern for output file names. The string 
                   '<FILE>' will be replaced by the name of 
                   the input file without extension.

BEHAVIOR

    Generates Typescript guards for all interfaces in the specified file.
    The checker will be a function who's name is: "is<Type name>" where the first
    letter of the type name is capitalized.
`);
    Deno.exit(0);
}

// Parse files and generate guards
if (args.file === undefined || args.file.length === 0) {
    console.error('At least one file must be specified via the -f FILE flag.');
    Deno.exit(1);
}

if (typeof args.file === 'string') {
    args.file = [args.file];
}

/**
 * Metadata regarding an interface definition which will be relevant to type
 * guard generation.
 */
interface InterfaceDef {
    /**
	* Declared name of interface.
	*/
    name: string

    /**
	* Defined properties.
	*/
    properties: InterfaceProp[]
}

/**
 * Metadata of an interface property which will be relevant to type 
 * guard generation.
 */
interface InterfaceProp {
    /**
	* Declared name of property.
	*/
    name: string

    /**
	* Kind if available.
	*/
    kind?: string
}

let guards: string[] = await Promise.all(args.file.map(async (fileName: string) => {
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
	   syntax: 'typescript',
    });

    const parsedItems: (ModuleItem[] | Statement) = parsed.body;
    const parsedInterfaceDefs = parsedItems
	   .filter((item): item is TsInterfaceDeclaration => {
		  return item.type === 'TsInterfaceDeclaration';
	   })

    const defs: InterfaceDef[] = parsedInterfaceDefs.map((item) => {
	   return {
		  name: item.id.value,
		  properties: item.body.body.map((prop) => {
			 // Check is a property signature
			 if (prop.type !== 'TsPropertySignature') {
				throw `encountered a TsInterfaceBody item of type = '${prop.type}' but expected 'TsPropertySignature'`;
			 }

			 // Ensure we can get the property name
			 if (prop.key.type !== 'Identifier') {
				throw `encountered a TsPropertySignature with a key.type = ${prop.key.type} but expected 'Identifier'`;
			 }
			 
			 // Get type of property if there is an annotation
			 let kind = undefined;
			 
			 if (prop.typeAnnotation !== null &&
				prop.typeAnnotation !== undefined) {
				
				// What type of type annotation?
				const annotation = prop.typeAnnotation.typeAnnotation;
				let kind = null;
				
				if (annotation.type === 'TsKeywordType') {
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

	   return `\
/**
 * Ensures that value is a ${def.name} interface.
 * @param value To check.
 * @returns True if value is ${def.name}, false otherwise.
 */
function ${guardName}(value: unknown) value is ${def.name} {

}
`;
    });

    // TODO we now have the interface declaration w everything we need, generate type guard
}));

const enc = new TextEncoder();
guards.forEach((guard: string) => {
    Deno.stdout.write(enc.encode(guard.toString()));
});
