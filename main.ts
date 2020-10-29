import { parse as parseFlags } from 'https://deno.land/std/flags/mod.ts';
import TSParse from "https://jspm.dev/typescript-parser";

// Parse command line arguments
const args = parseFlags(Deno.args, {
    alias: {
	   "h": "help",
	   "f": "file",
	   "o": "output",
    },
    default: {
	   "output": "<FILE>-guard.ts",
    },
});

if (args.help === true) {
    console.log(`deno-interface-guards - automatically generates Typescript guards

USAGE

    deno-interface-guards [-h,--help] -f,--file FILE... -o,--output OUT_PATTERN

OPTIONS

    -h,--help      Show help text.
    -f,--file      One or more input files.
    -o,--output    Pattern for output file names. The string 
                   "<FILE>" will be replaced by the name of 
                   the input file without extension.

BEHAVIOR

    Generates Typescript guards for all interfaces in the specified file.
    The checker will be a function who's name is the type's name.
`);
    Deno.exit(0);
}

// Parse files
const tsParser = new TSParse.TypescriptParser();

if (args.file === undefined || args.file.length === 0) {
    console.error('At least one file must be specified via the -f FILE flag.');
    Deno.exit(1);
}

if (typeof args.file === 'string') {
    args.file = [args.file];
}

for (const i in args.file) {
    const file = args.file[i];

    // Read file
    let txt = null;

    try {
	   txt = await Deno.readTextFile(file);
    } catch (e) {
	   console.error(`Failed to open ${file}: ${e}`);
	   Deno.exit(1);
    }

    // Parse interface declarations
    const parsed = await tsParser.parseSource(txt);
    const ifaces = parsed.declarations
	   .filter((decl: any) => decl instanceof TSParse.InterfaceDeclaration);

    // TODO we now have the interface declaration w everything we need, generate type guard
}
