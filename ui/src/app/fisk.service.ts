import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})

export class FiskService {
    private socket: WebSocket;
    private pending: Array<string>;
    private messageListeners: { (data: any): void; } [];
    private closeListeners: { (data: any): void; } [];
    private open: boolean;

    constructor() {
        this.socket = new WebSocket('ws://localhost:8999');
        this.pending = [];
        this.messageListeners = [];
        this.closeListeners = [];
        this.open = false;

        this.socket.addEventListener('open', event => {
            this.open = true;
            // send all the pending stuff
            for (let i = 0; i < this.pending.length; ++i) {
                this.socket.send(this.pending[i]);
            }
            this.pending = undefined;
        });
        this.socket.addEventListener('message', event => {
            let data: any;
            try {
                data = JSON.parse(event.data);
            } catch (e) {
                console.error("unable to parse json", event.data);
                return;
            }
            for (let i = 0; i < this.messageListeners.length; ++i) {
                this.messageListeners[i](data);
            }
        });
        this.socket.addEventListener('close', () => {
            for (let i = 0; i < this.closeListeners.length; ++i) {
                this.closeListeners[i]();
            }
        }
    }

    on(name: string, on: { (data: any): void; }) {
        if (name == "message") {
            this.messageListeners.push(on);
        } else if (name == "close") {
            this.closeListeners.push(on);
        }
    }

    send(data: any) {
        if (this.open) {
            this.socket.send(JSON.stringify(data));
        } else {
            this.pending.push(JSON.stringify(data));
        }
    }
}