import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { RTTConsoleDecoderOpts, TerminalInputMode } from '../common';
import { SWORTTSource } from './swo/sources/common';
import EventEmitter = require('events');
export class RTTTerminal extends EventEmitter implements SWORTTSource   {
    connected: boolean;
    protected _rttTerminal: vscode.Terminal = null;
    public get rttTerminal(): vscode.Terminal {
        return this._rttTerminal;
    }

    private _name: string;
    public get name(): string {
        return this._name;
    }

    private _inUse: boolean = false;
    public get inUse(): boolean {
        return this._inUse;
    }
    public set inUse(value: boolean) {
        this._inUse = value;
    }

    constructor(
        protected context: vscode.ExtensionContext,
        public options: RTTConsoleDecoderOpts) {
        super();
    }
    dispose() {
        // process.kill(this.rttTerminal.processId)
        if (this.rttTerminal) {
            this.rttTerminal.dispose();
        }
        this._rttTerminal = null;
        this.connected = false;
        this.inUse = false;
    }

    public startTerminal(): boolean {
        const script = path.join(this.context.extensionPath, 'dist', 'tcp_cat.bundle.js');
        this._name = RTTTerminal.createTermName(this.options);
        const args = {
            name: this.name,
            shellPath: 'node',
            shellArgs: [script,
                "--port", this.options.tcpPort,   // Can be [host:]port
                "--encoding", this.options.encoding || 'utf8'
            ]
        };

        if (this.options.noprompt) {
            args.shellArgs.push('--noprompt');
        } else {
            args.shellArgs.push('--prompt', this.options.prompt || `RTT-${this.options.port}> `);
        }

        if (this.options.clear) {
            args.shellArgs.push('--clear');
        }
        if (this.options.inputmode === TerminalInputMode.RAW) {
            args.shellArgs.push('--raw');
        } else if (this.options.inputmode === TerminalInputMode.RAWECHO) {
            args.shellArgs.push('--rawecho');
        }

        if (this.options.type === 'binary') {
            args.shellArgs.push('--binary');
            if (this.options.scale) {
                args.shellArgs.push('--scale', `${this.options.scale}`);
            }
        }

        if (this.options.logfile) {
            try {
                fs.writeFileSync(this.options.logfile, "");
                args.shellArgs.push('--logfile', this.options.logfile);
            }
            catch (e) {
                vscode.window.showErrorMessage(
                    `RTT logging failed ${this.options.logfile}: ${e.toString()}`);
            }
        }

        try {
            this._rttTerminal = vscode.window.createTerminal(args);
            setTimeout(() => {
                this._rttTerminal.show();
            }, 100);
            this.connected = true;
            this.inUse = true;
            return true;
        }
        catch (e) {
            vscode.window.showErrorMessage(`Terminal start failed: ${e.toString()}`);
            return false;
        }     
    }

    static createTermName(options: RTTConsoleDecoderOpts): string {
        const channel = options.port || 0;
        const orig = options.label || `RTT Ch:${channel}`;
        let ret = orig;
        let count = 1;
        while (vscode.window.terminals.findIndex((t) => t.name === ret) >= 0) {
            ret = `${orig}-${count}`;
            count = count + 1;
        }
        return ret;
    }

    public canReuse(options: RTTConsoleDecoderOpts) {
        for (const prop of ['type', 'tcpPort', 'port', 'label', 'prompt', 'noprompt', 'logfile', 'clear', 'scale']) {
            if (options[prop] !== this.options[prop]) {
                return false;
            }
        }
        return true;
    }
}