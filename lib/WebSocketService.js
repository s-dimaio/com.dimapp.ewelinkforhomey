const EventEmitter = require('events');
const WebSocket = require('ws'); // Import WebSocket from the 'ws' library

/**
 * WebSocketService class to handle WebSocket connections.
 */
class WebSocketService extends EventEmitter {
    /**
     * Constructs a new WebSocketService instance.
     * @param {Object} tokenObj - The token object containing accessToken and region.
     * @param {Object} wsClient - The WebSocket client instance.
     * @param {Object} client - The client instance.
     * @param {boolean} [showLog=false] - Whether to show logs.
     * @example
     * const tokenObj = { data: { accessToken: 'yourAccessToken' }, region: 'us' };
     * const wsService = new WebSocketService(tokenObj, wsClient, client);
     */
    constructor(tokenObj, wsClient, client, showLog = false) {
        super();

        this.showLog = showLog;
        this.eventsRegistered = false; // Add an instance variable

        this.wsClient = wsClient;
        this.client = client;

        this.region = tokenObj.region || "us";
        this.at = tokenObj.data.accessToken || "";
        this.userApiKey = null;

        this.client.at = this.at;
        this.client.region = this.region;
        this.client.setUrl(this.region);

        this.wsConnected = false; //flag used to verify connection status
    }

    /**
     * Logs messages to the console if logging is enabled.
     * @private
     * @param {...any} args - The messages to log.
     * @example
     * this._log('This is a log message');
     */
    _log(...args) {
        if (this.showLog) {
            const timestamp = new Date().toISOString();
            console.log(`%c${timestamp}`, 'color: green', `[WEB-SOCKET] -`, ...args);
        }
    }

    /**
     * Retrieves the user API key.
     * @returns {Promise<string|null>} The user API key or null if not found.
     * @example
     * const wsService = new WebSocketService(tokenObj, wsClient, client);
     * wsService.getUserApiKey().then(apiKey => {
     *     console.log(apiKey);
     * });
     */
    async getUserApiKey() {
        const response = await this.client.home.getFamily({});
        this.userApiKey = response.error === 0 ? response.data.familyList[0]?.apikey : null;
    }

    /**
     * Checks if the WebSocket is connected.
     * @returns {boolean} True if connected, false otherwise.
     * @example
     * const wsService = new WebSocketService(tokenObj, wsClient, client);
     * console.log(wsService.isConnected()); // Output: true or false
     */
    isConnected() {
        if (!this.wsClient) {
            this._log("WebSocket client not initialized");
            return false;
        }

        this._log("WebSocket connected:", this.wsConnected);
        this._log("WebSocket readyState:", this.wsClient.ws?.readyState);

        return this.wsConnected && this.wsClient.ws?.readyState === WebSocket.OPEN;
    }


    /**
     * Connects to the WebSocket server.
     * @returns {Promise<void>}
     * @example
     * const wsService = new WebSocketService(tokenObj, wsClient, client);
     * wsService.connectWebSocket();
     */
    async connectWebSocket() {
        await this.getUserApiKey();
        if (this.userApiKey && this.region) {
            if (!this.eventsRegistered) {
                const ws = await this.wsClient.Connect.create({ // wait for the promise to be resolved
                    appId: this.wsClient?.appId || "",
                    at: this.at,
                    region: this.region,
                    userApiKey: this.userApiKey
                }, (_ws) => { // this is the onOpen callback
                    this._log("connected");
                    this.wsConnected = true;
                    this.wsClient.ws = _ws; // set the web socket object to ws property
                    this.emit('connected');
                }, () => {
                    this._log("disconnected");
                    this.wsConnected = false;
                    this.emit('disconnected');
                }, (_err) => {
                    this._log("Error generated:", _err);
                    this.wsConnected = false;
                    this.emit('error', _err);
                }, (_ws, _msg) => {
                    //this._log("ws:", _ws);
                    //this.wsClient.Connect.ws = _ws; // DO NOT DO THIS!
                    this._log("Received message: ", _msg);
                    this.emit('message', _msg);
                });

                this.eventsRegistered = true; // Set to true after registering events
            }
        }
    }
}

module.exports = WebSocketService;
