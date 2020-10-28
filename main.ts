import { parse as parseFlags } from 'https://deno.land/std/flags/mod.ts';

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
if (args.file === undefined || args.file.length === 0) {
    console.error('At least one file must be specified via the -f FILE flag.');
    Deno.exit(1);
}

if (typeof args.file === 'string') {
    args.file = [args.file];
}

function mkRangedCharClass(record: Map<string, string>, start: string, end: string, cls: string) {
    if (start.charCodeAt(0) > end.charCodeAt(0)) {
	   throw 'start cannot be larger than end';
    }
    
    let c = start;
    while (c.charCodeAt(0) <= end.charCodeAt(0)) {
	   console.log('c', c);
	   record.set(c, cls);

	   c = String.fromCharCode(c.charCodeAt(0) + 1);
    }
}

const CHAR_CLASS_IGNORE = 'IGNORE';
const CHAR_CLASS_LETTER = 'LETTER';
const CHAR_CLASS_NUMBER = 'NUMBER';
const CHAR_CLASS_SEMICOLON = 'SEMICOLON';
const CHAR_CLASS_COLON = 'COLON';
const CHAR_CLASS_OPERATOR = 'OPERATOR';

let CHAR_CLASSES = new Map<string, string>();
CHAR_CLASSES.set('\n', CHAR_CLASS_IGNORE);
CHAR_CLASSES.set(';', CHAR_CLASS_SEMICOLON);
CHAR_CLASSES.set(':', CHAR_CLASS_COLON);
CHAR_CLASSES.set('{'
mkRangedCharClass(CHAR_CLASSES, 'a', 'z', CHAR_CLASS_LETTER);
mkRangedCharClass(CHAR_CLASSES, 'A', 'Z', CHAR_CLASS_LETTER);
mkRangedCharClass(CHAR_CLASSES, '0', '9', CHAR_CLASS_NUMBER);

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

    const chars = txt.split('');

    // 
}
