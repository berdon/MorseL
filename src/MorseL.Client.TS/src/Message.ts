export enum MessageType {
            /// <summary>
        /// A pure text message.
        /// </summary>
        Text = 0,

        /// <summary>
        /// A message that is intended to invoke a method on the Hub.
        /// Generally results in a response of <see cref="InvocationResult"/>
        /// or <see cref="Error"/>.
        /// </summary>
        ClientMethodInvocation = 1,

        /// <summary>
        /// Indicates an event of significance occurred with the connection.
        /// Currently only used for indicating a connection was successfully
        /// established.
        /// </summary>
        ConnectionEvent = 2,

        /// <summary>
        /// A method invocation result method.
        /// </summary>
        InvocationResult = 3,

        /// <summary>
        /// Indicates an errored message. Used in cases where an error dispatched
        /// via <see cref="InvocationResult"/> is not possible.
        /// </summary>
        Error = 4,

        /// <summary>
        /// Request a client connection disconnect. Not actually sent to
        /// clients but does close the client connection from the server side.
        /// </summary>
        Disconnect = 5,
}

export class Message {
    public Id: string;
    public MessageType: MessageType;
    public Data: string;
}
