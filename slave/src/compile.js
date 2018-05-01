const child_process = require('child_process');
const mktemp = require('mktemp');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const magicalObjectName = 'fisk-slave-out';

class Compile extends EventEmitter {
    constructor(args, preprocessed) {
        super();
        if (!args || !args.length || !preprocessed) {
            throw new Error("Bad args");
        }
        const compiler = args.shift();
        const tmpdir = mktemp.createDirSync('/tmp/fisk-slave-compile-XXX-XXX');

        var hasDashX = false;
        var sourceFile;
        var originalOutput;
        for (var i=0; i<args.length; ++i) {
            switch (args[i]) {
            case '-o':
                originalOutput = args[++i];
                args[i] = path.join(tmpdir, magicalObjectName);
                break;
            case '-x':
                hasDashX = true;
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
                break;
            case '--param':
            case '-G':
            case '-I':
            case '-MF':
            case '-MQ':
            case '-MT':
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
            case '-isysroot':
            case '-ivfsoverlay':
            case '-iwithprefix':
            case '-iwithprefixbefore':
            case '-target':
                ++i;
                break;
            default:
                if (args[i][0] != '-') {
                    sourceFile = args[i];
                    args[i] = "-";
                }
                break;
            }
        }
        if (!sourceFile) {
            throw new Error("No sourcefile");
        }

        if (!originalOutput) {
            args.push('-o');
            args.push(tmpdir + "/slave.out");
            originalOutput = sourceFile.substr(0, sourceFile.length - path.extname(sourceFile).length + 1) + "o";
        }

        if (!hasDashX) {
            switch (path.extname(sourceFile)) {
            case '.C':
            case '.cc':
            case '.cpp':
            case '.CPP':
            case '.c++':
            case '.cp':
            case '.cxx':
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
                args.unshift('cpp-output');
                break;
            case '.m':
            case '.mi':
                args.unshift('objective-c-cpp-output');
                break;
            case '.mm':
            case '.M':
            case '.mii':
                args.unshift('objective-c++-cpp-output');
                break;
            default:
                throw new Error(`Can't determine source language for file: ${sourceFile}`);
            }
            args.unshift('-x');
        }
        args.push('-fpreprocessed'); // is this good for clang?
        console.log(args.join(' '));
        var proc = child_process.spawn(compiler, args, { cwd: tmpdir });
        proc.stdout.on('data', data => {
            this.emit('stdout', data);
        });
        proc.stderr.on('data', data => {
            this.emit('stderr', data);
        });
        proc.on('error', err => {
            this.emit('error', err);
        });

        proc.on('exit', (code, signal) => {
            // try {
            let files = [];
            function addDir(dir, prefix) {
                try {
                    fs.readdirSync(dir).forEach(file => {
                        try {
                            let stat = fs.statSync(path.join(dir, file));
                            if (stat.isDirectory()) {
                                addDir(path.join(dir,  file), prefix ? prefix + file + '/' : file + '/');
                            } else if (stat.isFile()) {
                                let contents = fs.readFileSync(path.join(dir, file));
                                if (file === magicalObjectName)
                                    file = originalOutput;
                                files.push(prefix + file, contents);
                            }
                        } catch (err) {
                        }
                    });
                } catch (err) {
                    this.emit('exit', { code: 101, signal: signal, files: [], error: err });
                    return;
                }
            }
            addDir(tmpdir, "");
            this.emit('exit', { code: code, signal: signal, files: files });

        });
        proc.stdin.write(preprocessed);
        proc.stdin.end();
    }
}

// var preproc = fs.readFileSync("/tmp/preproc");
// var f = new Compile([ "/usr/bin/c++", "-Iclient", "-I3rdparty/json11", "-I3rdparty/wslay/lib/includes", "-I3rdparty/wslay/lib", "-I3rdparty/LUrlParser", "-I3rdparty/tiny-process-library", "-std=c++14", "-Wformat", "-Wall", "-g", "-MD", "-MT", "client/CMakeFiles/fiskc.dir/Config.cpp.o", "-MF", "client/CMakeFiles/fiskc.dir/Config.cpp.o.d", "-o", "client/CMakeFiles/fiskc.dir/Config.cpp.o", "-c", "client/Config.cpp" ], preproc);
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