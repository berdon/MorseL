import { InvocationDescriptor } from './InvocationDescriptor'
import { InvocationResultDescriptor } from './InvocationResultDescriptor'
import { Message, MessageType } from './Message'
import { Middleware } from './Middleware'
import { EventEmitter } from 'events'

const WebSocket = require('isomorphic-ws')

/**
 * MorseL client connection object; encompasses all MorseL functionality.
 */
export class Connection {

    public uri: string;
    public connectionId: string;
    public enableLogging: boolean = false;
    
    public get isConnected(): boolean {
        return this._isConnected;
    }

    protected socket: WebSocket;

    protected middlewares: Middleware[] = [];

    private _isConnected: boolean = false;
    private _callbacks: EventEmitter = new EventEmitter();
    private _pendingCalls: { [requestId: number]: Function; } = {};

    constructor(url: string, enableLogging: boolean=false) {
        this.uri = url;
        
        this.enableLogging = enableLogging;

        this._callbacks.on('onConnected', () => {
            if(this.enableLogging) {
                console.log('Connected! connectionId: ' + this.connectionId);
            }
        });

        this._callbacks.on('onDisconnected', () => {
            if(this.enableLogging) {
                console.log('Connection closed from: ' + this.uri);
            }
        });

        this._callbacks.on('onOpen', (socketOpenedEvent: any) => {
            if(this.enableLogging) {
                console.log('WebSockets connection opened!');
            }
        });
    }

    public addMiddleware(middleware: Middleware) {
        this.middlewares.push(middleware);
    }

    public on(event: string, delegate: (...args: any[]) => any): void {
        this._callbacks.on(event, delegate);
    }

    public start(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.socket = new WebSocket(this.uri);

            this.socket.onopen = (event: MessageEvent) => {
                this._callbacks.emit('onOpen', event);
            };

            this.socket.onmessage = (event: MessageEvent) => {
                var index = 0;
                const delegate = (transformedData: string): void => {
                    if (index < this.middlewares.length) {
                        this.middlewares[index++].receive(transformedData, delegate);
                    } else {
                        const message = JSON.parse(transformedData);

                        if (message.MessageType == MessageType.Text) {
                            if(this.enableLogging) {
                                console.log('Text message received. Message: ' + message.Data);
                            }
                        }

                        else if (message.MessageType == MessageType.ClientMethodInvocation) {
                            let invocationDescriptor: InvocationDescriptor = JSON.parse(message.Data);
                            if (this.enableLogging) console.log(invocationDescriptor)
                            this._callbacks.emit(invocationDescriptor.MethodName, ...invocationDescriptor.Arguments);
                        }

                        else if (message.MessageType == MessageType.InvocationResult) {
                            let invocationResult: InvocationResultDescriptor = JSON.parse(message.Data);
                            if (this.enableLogging) console.log(invocationResult.Result)
                            let delegate = this._pendingCalls[invocationResult.Id];
                            delete this._pendingCalls[invocationResult.Id];
                            delegate.call(this, invocationResult.Result);
                        }

                        else if (message.MessageType == MessageType.ConnectionEvent) {
                            this.connectionId = message.Data;
                            this._isConnected = true;
                            this._callbacks.emit('onConnected');

                            resolve();

                            // Clear reject so subsequent errors don't cause us to die
                            reject = () => {};
                        }
                    }
                };

                delegate(event.data);
            }

            this.socket.onclose = (event: CloseEvent) => {
                this.connectionId = null;
                this._isConnected = false;
                this._callbacks.emit('onDisconnected', event);

                // Reject if it's available
                reject(event);
            }

            this.socket.onerror = (event: ErrorEvent) => {
                if(this.enableLogging) {
                    console.log('Error data: ' + event.error);
                }

                // Reject if it's available
                reject(event);
            }
        });
    }

    public invoke<T>(methodName: string, ...args: any[]): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const invocationDescriptor = new InvocationDescriptor(methodName, args);
            
            if(this.enableLogging) {
                console.log(invocationDescriptor);
            }

            var index = 0;
            const delegate = (transformedData: string): void => {
                if (index < this.middlewares.length) {
                    this.middlewares[index++].send(transformedData, delegate);
                } else {
                    this.socket.send(transformedData);
                }
            };

            this._pendingCalls[invocationDescriptor.Id] = (result: any) => {
                resolve(result as T)
            }

            delegate(JSON.stringify(invocationDescriptor));
        });
    }
}