const child_process = require('child_process');
const mktemp = require('mktemp');
const fs = require('fs-extra');
const path = require('path');
const EventEmitter = require('events');

class Compile extends EventEmitter {
    constructor(args, argv0, dir, debug) {
        super();

        if (!args || !args.length || !dir || !argv0) {
            console.error(argv0, args, dir);
            throw new Error("Bad args");
        }
        let compiler = args.shift();
        const isClang = compiler.indexOf('clang') != -1;

        let output;
        let depfile;
        let hasDashO = false;
        let hasMF = false;
        let hasM = false;
        let hasDashX = false;
        let sourceFile;
        for (let i=0; i<args.length; ++i) {
            // console.log(i, args[i]);
            switch (args[i]) {
            case '-o': {
                hasDashO = true;
                output = args[++i];
                args[i] = "output.o";
                break; }
            case '-MF': {
                hasMF = true;
                depfile = args[++i];
                args[i] = "output.d";
                break; }
            case '-MMD':
            case '-MD':
            case '-MM':
            case '-M':
                hasM = true;
                continue;
            case '-MT':
                ++i;
                continue;
            case '-cxx-isystem':
            case '-isysroot':
            case '-isystem':
            case '-I':
                args.splice(i--, 2);
                break;
            case '-x':
                hasDashX = true;
                if (!isClang) {
                    switch (args[++i]) {
                    case 'c':
                        args[i] = 'cpp-output';
                        break;
                    case 'c++':
                        args[i] = 'c++-cpp-output';
                        break;
                    case 'objective-c':
                        args[i] = 'objective-c-output';
                        break;
                    case 'objective-c++':
                        args[i] = 'objective-c++-cpp-output';
                        break;
                    default:
                        break;
                    }
                } else {
                    ++i;
                }
                break;
            case '--param':
            case '-G':
            case '-T':
            case '-V':
            case '-Xanalyzer':
            case '-Xassembler':
            case '-Xclang':
            case '-Xlinker':
            case '-Xpreprocessor':
            case '-arch':
            case '-b':
            case '-gcc-toolchain':
            case '-imacros':
            case '-imultilib':
            case '-include':
            case '-iprefix':
            case '-ivfsoverlay':
            case '-iwithprefix':
            case '-iwithprefixbefore':
            case '-target':
                ++i;
                break;
            default:
                if (/^-mlinker-version=/.exec(args[i]) || /^-stdlib=/.exec(args[i])) {
                    args.splice(i--, 1);
                    break;
                }

                if (args[i][0] != '-') {
                    if (sourceFile) {
                        console.log("Multiple source files", sourceFile, args[i]);
                        throw new Error("More than one source file");
                    }
                    sourceFile = args[i];
                    args[i] = path.join(dir, 'sourcefile');
                }
                break;
            }
        }
        if (!sourceFile) {
            throw new Error("No sourcefile");
        }

        if (!hasDashX) {
            if (compiler.indexOf('g++') != -1 || compiler.indexOf('c++') != -1) {
                args.unshift(isClang ? 'c++' : 'c++-cpp-output');
            } else {
                switch (path.extname(sourceFile)) {
                case '.C':
                case '.cc':
                case '.cpp':
                case '.CPP':
                case '.c++':
                case '.cp':
                case '.cxx':
                    args.unshift(isClang ? 'c++' : 'c++-cpp-output');
                    break;
                case '.ii':
                    args.unshift('c++-cpp-output');
                    break;
                case '.hh':
                case '.hpp':
                case '.H':
                    args.unshift('c++-header');
                    break;
                case '.h':
                    args.unshift('c-header');
                    break;
                case '.c':
                    args.unshift(isClang ? 'c' : 'cpp-output');
                    break;
                case '.i':
                    args.unshift('cpp-output');
                    break;
                case '.m':
                case '.mi':
                    args.unshift(isClang ? 'objective-c' : 'objective-c-cpp-output');
                    break;
                case '.s':
                    args.unshift('assembler');
                    break;
                case '.sx':
                case '.S':
                    args.unshift('assembler-with-cpp');
                    break;
                case '.mm':
                case '.M':
                case '.mii':
                    args.unshift(isClang ? 'objective-c++' : 'objective-c++-cpp-output');
                    break;
                default:
                    throw new Error(`Can't determine source language for file: ${sourceFile}`);
                }
            }
            args.unshift('-x');
        }
        if (compiler.indexOf('clang') == -1) {
            args.push('-fpreprocessed', '-fdirectives-only'); // this is not good for clang
        } else {
            args.push('-Wno-stdlibcxx-not-found');
        }

        if (!hasDashO) {
            args.push("-o", "output.o");
            let suffix = path.extname(sourceFile);
            output = sourceFile.substr(0, sourceFile.length - suffix) + ".o";
        }

        if (hasM && !hasMF) {
            args.push("-MF", "output.d");
            let suffix = path.extname(sourceFile);
            depfile = sourceFile.substr(0, sourceFile.length - suffix) + ".d";
        }

        // debug = true;
        if (debug)
            console.log("CALLING", argv0, compiler, args.map(x => '"' + x + '"').join(" "));
        if (!fs.existsSync("/usr/bin/as")) {
            this.emit("stderr", "as doesn't exist");
        }
        let proc = child_process.spawn(compiler, args, { cwd: dir, maxBuffer: 1024 * 1024 * 16 });
        this.proc = proc;
        proc.stdout.setEncoding('utf8');
        proc.stderr.setEncoding('utf8');

        proc.stdout.on('data', data => {
            this.emit('stdout', data);
        });
        proc.stderr.on('data', data => {
            this.emit('stderr', data);
        });
        proc.on('error', err => {
            this.emit('error', err);
        });

        proc.on('exit', (exitCode) => {
            // try {
            var that = this;
            let files = [];
            function addDir(dir, prefix) {
                try {
                    fs.readdirSync(dir).forEach(file => {
                        if (file === 'sourcefile')
                            return;
                        try {
                            let stat = fs.statSync(path.join(dir, file));
                            if (stat.isDirectory()) {
                                addDir(path.join(dir, file), prefix ? prefix + file + '/' : file + '/');
                            } else if (stat.isFile()) {
                                if (file == "output.o") {
                                    files.push({ path: output, mapped: path.join(prefix, file) });
                                } else if (file == "output.d") {
                                    files.push({ path: depfile, mapped: path.join(prefix, file) });
                                } else if (file == "output.gcno") {
                                    // console.log("mapping", output, prefix, file);
                                    files.push({ path: output.substr(0, output.length - 1) + "gcno", mapped: path.join(prefix, file) });
                                } else if (file == "output.gcda") {
                                    files.push({ path: output.substr(0, output.length - 1) + "gcda", mapped: path.join(prefix, file) });
                                } else {
                                    files.push({ path: path.join(prefix, file) });
                                }
                                if (debug)
                                    console.log("Added file", file, files[files.length - 1]);
                            }
                        } catch (err) {
                        }
                    });
                } catch (err) {
                    that.emit('exit', { exitCode: 101, files: [], error: err, sourceFile: sourceFile });
                    return;
                }
            }
            addDir(dir, dir);
            this.emit('exit', { exitCode: exitCode, files: files, sourceFile: sourceFile });
        });
    }

    kill() {
        this.proc.kill();
    }
}

// let preproc = fs.readFileSync("/tmp/preproc");
// let f = new Compile([ "/usr/bin/c++", "-Iclient", "-I3rdparty/json11", "-I3rdparty/wslay/lib/includes", "-I3rdparty/wslay/lib", "-I3rdparty/LUrlParser", "-I3rdparty/tiny-process-library", "-std=c++14", "-Wformat", "-Wall", "-g", "-MD", "-MT", "client/CMakeFiles/fiskc.dir/Config.cpp.o", "-MF", "client/CMakeFiles/fiskc.dir/Config.cpp.o.d", "-o", "client/CMakeFiles/fiskc.dir/Config.cpp.o", "-c", "client/Config.cpp" ], preproc);
// f.on('stdout', (data) => {
//     console.log("Got out", data.length);
// });

// f.on('stderr', (data) => {
//     console.log("Got err", data.toString());
// });
// f.on('error', error => {
//     console.log("Got error", error);
// });

// f.on('exit', event => {
//     console.log("Got exit", event);
// });
module.exports = Compile;
