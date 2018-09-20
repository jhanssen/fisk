#!/usr/bin/env node

const WebSocket = require("ws");
const crypto = require("crypto");
const argv = require("minimist")(process.argv.slice(2));
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// console.log("shit");
const ws = new WebSocket((argv.scheduler || "ws://localhost:8097") + "/monitor");
ws.on("upgrade", res => {
    // console.log("GOT HEADERS", res.headers);
    ws.nonce = res.headers["x-fisk-nonce"];
});
ws.on("open", () => {
    console.log("got open", argv, ws.nonce);
    if (argv.addUser) {
        console.log("addUser");
        ws.send(JSON.stringify({type: "addUser", user: "agbakken@gmail.com", password: "ball1"}));
        loop();
    } else if (argv.cookie) {
        let hmac = crypto.createHmac("sha512", Buffer.from(argv.cookie, "base64"));
        hmac.write(ws.nonce);
        hmac.end();
        const msg = { type: "login", user: "agbakken@gmail.com", hmac: hmac.read().toString("base64") };
        ws.send(JSON.stringify(msg));
        console.log(`cookie login ${JSON.stringify(msg, null, 4)}`);
        loop();
    } else if (argv.login) {
        ws.send(JSON.stringify({type: "login", user: "agbakken@gmail.com", password: "ball1"}));
        console.log("login");
        loop();
    } else if (argv.listUsers) {
        ws.send(JSON.stringify({type: "login", user: "agbakken@gmail.com", password: "ball1"}));
        setTimeout(() => {
            ws.send(JSON.stringify({type: "listUsers"}));
            console.log("listUsers");
            loop();
        }, 500);
    } else if (argv.readConfiguration) {
        ws.send(JSON.stringify({type: "login", user: "agbakken@gmail.com", password: "ball1"}));
        setTimeout(() => {
            ws.send(JSON.stringify({type: "readConfiguration"}));
            console.log("readConfiguration");
            loop();
        }, 500);
    } else if (argv.addCompatibleHash) {
        ws.send(JSON.stringify({type: "login", user: "agbakken@gmail.com", password: "ball1"}));
        setTimeout(() => {
            ws.send(JSON.stringify({type: "writeConfiguration", field: "compatibleHash", add: [ "foobar1", "foobar2" ]}));
            console.log("writeConfiguration");
            loop();
        }, 500);
    } else if (argv.removeUser) {
        ws.send(JSON.stringify({type: "login", "user": "agbakken@gmail.com", "password": "ball1"}));
        setTimeout(() => {
            ws.send(JSON.stringify({type: "removeUser", "user": "agbakken@gmail.com"}));
            console.log("removeUser");
            loop();
        }, 500);
    }
});
ws.on("headers", (headers, res) => {
    console.log("Got headers", headers);
});
// setInterval(() => {
//     console.log("fuck");
// }, 1000);
ws.on("error", err => {
    console.log("got error", err);
});
ws.on("message", msg => {
    console.log("Got message", JSON.stringify(JSON.parse(msg), null, 4));
});

function loop()
{
    rl.question('What do you think of Node.js? ', (answer) => {
        // TODO: Log the answer in a database
        try {
            let message = eval(answer);
            console.log("GOR MESSAGE", JSON.stringify(message, null, 4), answer);
        } catch (err) {
            console.error(`That does not compute: ${err.toString()}`);
        }
        setTimeout(loop, 0);
    });
}
