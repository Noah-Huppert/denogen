import { parse as parseFlags } from 'https://deno.land/std/flags/mod.ts';
import { parse as parseTs } from 'https://github.com/nestdotland/deno_swc/raw/master/mod.ts';
import {
    ModuleItem,
    Statement,
    TsKeywordType,
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

for (const i in args.file) {
    const file = args.file[i];

    // Read file
    let srcTxt = null;

    try {
	   srcTxt = await Deno.readTextFile(file);
    } catch (e) {
	   console.error(`Failed to open ${file}: ${e}`);
	   Deno.exit(1);
    }

    // Parse interface declarations
    const parsed = parseTs(srcTxt, {
	   syntax: 'typescript',
    });

    const parseItems: (ModuleItem[] | Statement) = parsed.body;

    const defs = parseItems.map((item) => {
	   // Ensure we have an interface declaration
	   if (item.type !== 'TsInterfaceDeclaration') {
		  return undefined;
	   } else if (item.body.type !== 'TsInterfaceBody') {
		  return undefined;
	   }

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
    })
    // We returned undefined in the map above if we encountered a node that
    // was not an interface definition, this will occur a lot and is fine, but
    // we should filter these out now.
	   .filter((item: any) => item !== undefined);

    // TODO we now have the interface declaration w everything we need, generate type guard
}
