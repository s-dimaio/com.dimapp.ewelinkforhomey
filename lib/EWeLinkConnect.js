const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const Router = require('koa-router');
const EventEmitter = require('events');

const WebSocketService = require('./WebSocketService.js');
const eWeLink = require('ewelink-api-next').default;

/**
 * EWelinkConnect class to handle the OAuth login process and device management.
 */
class EWeLinkConnect extends EventEmitter {
  /**
   * Creates an instance of EWelinkConnect.
   * @param {Object} config - The configuration object.
   * @param {boolean} [showLog=false] - Whether to show logs.
   * @param {string} [successMessage='Login successful, you can close this window now.'] - The message to show on successful login.
   * @param {string} [successImageUrl=''] - The image URL to show on successful login.
   * @param {string} [errorMessage='Login failed, please try again.'] - The message to show on failed login.
   * @param {string} [errorImageUrl=''] - The image URL to show on failed login.
   * @throws {Error} If appId or appSecret is not configured.
   * 
   * @example
   * const config = { appId: 'your-app-id', appSecret: 'your-app-secret', serverUrl: 'http://127.0.0.1', serverPort: 8000 };
   * const eWelinkConnect = new EWelinkConnect(config, true);
   * eWelinkConnect.on('loginSuccess', (token) => { console.log('Login successful, token:', token); });
   * eWelinkConnect.on('loginFailure', (error) => { console.error('Login failed:', error); });
   */
  constructor(
    config,
    showLog = false,
    successMessage = 'Login successful, you can close this window now.',
    successImageUrl = '',
    errorMessage = 'Login failed, please try again.',
    errorImageUrl = ''
  ) {
    super();
    this.showLog = showLog;

    this.config = config; // Set config as an instance variable
    this.eventsRegistered = false; // Add an instance variable

    if (!config.appId || !config.appSecret) {
      throw new Error('Please configure appId and appSecret');
    }

    this.client = new eWeLink.WebAPI(config);

    this.app = new Koa();
    this.router = new Router();

    this.app.use(bodyParser());

    this.router.get('/login', async (ctx) => {
      // Get login URL
      const loginUrl = this.client.oauth.createLoginUrl({
        redirectUrl: config.serverUrl + ':' + config.serverPort + '/redirectUrl',
        grantType: 'authorization_code',
        state: this._randomString(10),
      });
      // Automatically redirect to Log in URL
      ctx.redirect(loginUrl);
    });

    this.router.get('/redirectUrl', async (ctx) => {
      const { code, region } = ctx.request.query;
      this._log(code, region);
      try {
        const res = await this.client.oauth.getToken({
          region,
          redirectUrl: config.serverUrl + ':' + config.serverPort + '/redirectUrl',
          code,
        });
        res['region'] = region;
        // You can write your own business here
        this._log(res);
        //ctx.body = res;
        ctx.type = 'html';
        ctx.body = this._generateCloseWindowHtmlContent(successMessage, successImageUrl);

        this.emit('loginSuccess', res);
        // Chiudi il server Koa
        if (this.server) {
          this.server.close(() => {
            this._log('Koa server stopped');
          });
        }
      } catch (error) {
        console.error('Login failed:', error);
        //ctx.body = { error: 'Login failed' };
        ctx.type = 'html';
        ctx.body = this._generateCloseWindowHtmlContent(errorMessage, errorImageUrl);

        this.emit('loginFailure', error);
        // Chiudi il server Koa
        if (this.server) {
          this.server.close(() => {
            this._log('Koa server stopped');
          });
        }
      }
    });

    this.app.use(this.router.routes());
  }

  /**
   * Generates HTML content to display a message and an optional image, typically used to inform the user about the login status.
   *
   * @private
   * @param {string} message - The message to display to the user.
   * @param {string} imageUrl - The URL of the image to display. If empty, no image is displayed.
   * @returns {string} The generated HTML content.
   *
   * @example
   * const successHtml = this._generateCloseWindowHtmlContent('Login successful!', 'https://example.com/success.png');
   * console.log(successHtml);
   *
   * const failureHtml = this._generateCloseWindowHtmlContent('Login failed.', '');
   * console.log(failureHtml);
   */
  _generateCloseWindowHtmlContent(message, imageUrl) {
    const imageHtml = imageUrl
      ? `
    <div class="image-container">
        <img src="${imageUrl}" alt="Immagine personalizzata">
    </div>`
      : '';

    return `
      <!DOCTYPE html>
      <html lang="it">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Messaggio personalizzato</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    background-color: #f0f0f0;
                }
                .image-container {
                    margin-bottom: 20px;
                }
                img {
                    max-width: 100%;
                    height: auto;
                }
                .message {
                    font-size: 24px;
                    color: #333;
                    text-align: center;
                }
            </style>
        </head>
        <body>
            ${imageHtml}
            <div class="message">
                ${message}
            </div>
        </body>
      </html>
    `;
  }

  /**
   * Generates a random string of the specified length.
   * 
   * @private
   * @param {number} length - The length of the random string.
   * @returns {string} The generated random string.
   * 
   * @example
   * const randomStr = this._randomString(10);
   * console.log(randomStr); // Output: 'a1b2c3d4e5'
   */
  _randomString(length) {
    return [...Array(length)].map(_ => (Math.random() * 36 | 0).toString(36)).join('');
  }

  /**
   * Logs messages to the console if logging is enabled.
   * 
   * @private
   * @param {...any} args - The messages to log.
   * 
   * @example
   * this._log('This is a log message');
   */
  _log(...args) {
    if (this.showLog) {
      const timestamp = new Date().toISOString();
      console.log(`%c${timestamp}`, 'color: green', `[EWELINK-CONNECT] -`, ...args);
    }
  }


  _isValidJson(str) {
    try {
      JSON.parse(str);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Retrieves the list of families.
   * 
   * @private
   * @returns {Promise<Array>} The list of families.
   * @throws {Error} If there is an error retrieving the family list.
   * 
   * @example
   * const families = await eWelinkConnect.getFamilyList();
   * console.log(families);
   */
  async _getFamilyList() {
    try {
      const familyList = await this.client.home.getFamily();
      this._log('Family list:', JSON.stringify(familyList, null, 2));

      return familyList.data.familyList;
    } catch (e) {
      console.error('Failed to get family list:', e);
      throw e;
    }
  }

  /**
   * Retrieves the list of things.
   * 
   * @private
   * @returns {Promise<Array>} The list of things.
   * @throws {Error} If there is an error retrieving the thing list.
   * 
   * @example
   * const things = await eWelinkConnect.getThingsList();
   * console.log(things);
   */
  async _getThingsList() {
    try {
      const thingList = await this.client.device.getAllThingsAllPages({});
      this._log('Thing list:', JSON.stringify(thingList, null, 2));

      return thingList.data.thingList;
    } catch (e) {
      console.error('Failed to get device list:', e);
      throw e;
    }
  }

  /**
   * Starts the Koa server.
   * 
   * @example
   * eWelinkConnect.startServer();
   */
  startServer() {
    this._log('Starting Koa server');

    this.server = this.app.listen(this.config.serverPort);
    this._log(`Server is running at ${this.config.serverUrl}:${this.config.serverPort}`);
    this._log(`Login URL: ${this.config.serverUrl}:${this.config.serverPort}/login, automatically open browser in three seconds`);

    return `${this.config.serverUrl}:${this.config.serverPort}/login`
    // setTimeout(async () => {
    //   await open(`${this.config.serverUrl}:${this.config.serverPort}/login`);
    // }, 3000);
  }

  /**
   * Checks if the client is initialized.
   * @returns {boolean} True if the client is initialized, false otherwise.
   * @example
   * const eWelinkConnect = new EWeLinkConnect(config);
   * console.log(eWelinkConnect.isClientInitialized()); // Output: true or false
   */
  isClientInitialized() {
    if (!this.client || !this.client.at || !this.client.region) {
      return false;
    }
    return (
      typeof this.client.at === "string" &&
      this.client.at.trim() !== "" &&
      typeof this.client.region === "string" &&
      this.client.region.trim() !== ""
    );
  }



  /**
   * Initializes the client with the given token object.
   * @param {Object} tokenObj - The token object containing accessToken and region.
   * @returns {Promise<void>}
   * @throws {Error} If the token is expired and cannot be refreshed.
   * @example
   * await eWelinkConnect.initializeClient(tokenObj);
   */
  async initializeClient(tokenObj) {
    this.client.at = tokenObj.data?.accessToken;
    this.client.region = tokenObj?.region || 'eu';
    this.client.setUrl(tokenObj?.region || 'eu');

    if (
      tokenObj.data?.atExpiredTime < Date.now() &&
      tokenObj.data?.rtExpiredTime > Date.now()
    ) {
      this._log('Token expired, refreshing token');
      const refreshStatus = await this.client.user.refreshToken({
        rt: tokenObj.data?.refreshToken,
      });
      this._log(refreshStatus);
      if (refreshStatus.error === 0) {
        tokenObj = {
          status: 200,
          responseTime: 0,
          error: 0,
          msg: '',
          data: {
            accessToken: refreshStatus?.data?.at,
            atExpiredTime: Date.now() + 2592000000,
            refreshToken: refreshStatus?.data?.rt,
            rtExpiredTime: Date.now() + 5184000000,
          },
          region: this.client.region,
        };
        this.emit('tokenRefreshed', tokenObj);
      }
    }

    if (tokenObj.data?.rtExpiredTime < Date.now()) {
      this._log('Failed to refresh token, need to log in again to obtain token');
      throw new Error('Token expired');
    }
  }

  isWebSocketConnected() {
    if (!this.wsService) {
      this._log('WebSocket service is not initialized');
      return false;
    }
    return this.wsService.isConnected();
  }

  /**
   * Initializes the WebSocketService with the given token object.
   * @param {Object} tokenObj - The token object containing accessToken and region.
   * @returns {Promise<void>}
   * 
   * @example
   * await eWelinkConnect.initializeWebSocketService(tokenObj);
   */
  async initializeWebSocketService(tokenObj) {
    const wsClient = new eWeLink.Ws(this.config);
    this.wsService = new WebSocketService(tokenObj, wsClient, this.client, this.showLog);

    if (!this.eventsRegistered) {
      this.wsService.on('connected', () => {
        this.emit('wsConnected');
      });

      this.wsService.on('disconnected', () => {
        this.emit('wsDisconnected');
      });

      this.wsService.on('error', (err) => {
        this.emit('wsError', err);
      });

      this.wsService.on('message', (msg) => {
        this._log('WebSocket message:', msg);

        try {
          const symbols = Object.getOwnPropertySymbols(msg);
          const kDataSymbol = symbols.find(s => s.description === 'kData');

          let deviceStatus = {
            action: undefined,
            deviceid: undefined,
            params: undefined
          };

          if (kDataSymbol) {
            const kDataValue = msg[kDataSymbol];
            if (this._isValidJson(kDataValue)) {
              const parsedData = JSON.parse(kDataValue);

              deviceStatus.action = parsedData?.action;
              deviceStatus.deviceid = parsedData?.deviceid;
              deviceStatus.params = parsedData?.params;
            }
          }

          this.emit('wsMessage', deviceStatus);

        } catch (e) {
          console.error('Failed to parse message:', e);
          this.emit('wsError', e);
        }
      });

      this.eventsRegistered = true; // Set to true after registering events
    }

    await this.wsService.connectWebSocket();
  }


  /**
   * Retrieves the list of devices.
   * @returns {Promise<Array>} The list of devices.
   * 
   * @throws {Error} If there is an error retrieving the device list.
   * @example
   * const devices = await eWelinkConnect.getDeviceList();
   * console.log(devices);
   */
  async getDeviceList() {
    try {
      const thingList = await this._getThingsList();
      const familyList = await this._getFamilyList();
      let devices = [];

      for (const thing of thingList) {
        const roomId = thing?.itemData.family.roomid;

        let device = {
          id: thing?.itemData.deviceid,
          name: thing?.itemData.name,
          brandName: thing?.itemData.brandName,
          productModel: thing?.itemData.productModel,
          online: thing?.itemData.online,
          params: thing?.itemData.params,
          home: {
            id: null,
            name: null
          },
          room: {
            id: null,
            name: null
          }
        };

        for (const home of familyList) {
          for (const room of home.roomList) {
            if (room.id === roomId) {
              device.home.id = home.id;
              device.home.name = home.name;

              device.room.id = room.id;
              device.room.name = room.name;

              break;
            }
          }
        }

        devices.push(device);
      }

      this._log('Devices:', devices);
      return devices;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  /**
   * Retrieves the list of devices by home ID.
   * @param {string} id - The home ID.
   * @returns {Promise<Array>} The list of devices.
   * 
   * @throws {Error} If there is an error retrieving the device list.
   * @example
   * const devices = await eWelinkConnect.getDeviceListByHome('home-id');
   * console.log(devices);
   */
  async getDeviceListByHome(id) {
    try {
      const thingList = await this._getThingsList();
      const deviceList = thingList.filter(device => device.itemData.family.familyid === id);
      const familyList = await this._getFamilyList();
      let devices = [];

      for (const d of deviceList) {
        let roomId = d?.itemData.family.roomid;

        let device = {
          id: d?.itemData.deviceid,
          name: d?.itemData.name,
          brandName: d?.itemData.brandName,
          productModel: d?.itemData.productModel,
          online: d?.itemData.online,
          params: d?.itemData.params,
          home: {
            id: null,
            name: null
          },
          room: {
            id: null,
            name: null
          }
        };

        for (const home of familyList) {
          for (const room of home.roomList) {
            if (room.id === roomId) {
              device.home.id = home.id;
              device.home.name = home.name;

              device.room.id = room.id;
              device.room.name = room.name;

              break;
            }
          }
        }

        devices.push(device);
      }

      this._log('Devices:', devices);
      return devices;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  /**
   * Checks if a device is online.
   * @param {string} id - The device ID.
   * @returns {Promise<boolean>} True if the device is online, false otherwise.
   * @throws {Error} If there is an error retrieving the device status.
   * @example
   * const isOnline = await eWelinkConnect.isOnline('device-id');
   * console.log(isOnline); // Output: true or false
   */
  async isOnline(id) {
    try {
      const device = await this.getDeviceById(id);
      if (!device) {
        throw new Error(`Device with ID ${id} not found`);
      }
      return device.online;
    } catch (e) {
      console.error('Failed to check if device is online:', e);
      throw e;
    }
  }

  /**
   * Retrieves a device by its ID.
   * @param {string} id - The device ID.
   * @returns {Promise<Object|null>} The device object or null if not found.
   * 
   * @throws {Error} If there is an error retrieving the device.
   * @example
   * const device = await eWelinkConnect.getDeviceById('device-id');
   * console.log(device);
   */
  async getDeviceById(id) {
    try {
      const thingList = await this._getThingsList();
      const filteredItems = thingList.filter(item => item.itemData.deviceid === id);
      const familyList = await this._getFamilyList();

      if (filteredItems.length > 0) {
        const d = filteredItems[0];

        let roomId = d?.itemData.family.roomid;

        let device = {
          id: d?.itemData.deviceid,
          name: d?.itemData.name,
          brandName: d?.itemData.brandName,
          productModel: d?.itemData.productModel,
          online: d?.itemData.online,
          params: d?.itemData.params,
          home: {
            id: null,
            name: null
          },
          room: {
            id: null,
            name: null
          }
        };

        for (const home of familyList) {
          for (const room of home.roomList) {
            if (room.id === roomId) {
              device.home.id = home.id;
              device.home.name = home.name;

              device.room.id = room.id;
              device.room.name = room.name;

              break;
            }
          }
        }

        this._log('Device:', device);
        return device;

      } else {
        this._log('No device found with id:', id);
        return null;
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  /**
   * Retrieves the list of homes.
   * @returns {Promise<Array>} The list of homes.
   * 
   * @throws {Error} If there is an error retrieving the homes list.
   * @example
   * const homes = await eWelinkConnect.getHomesList();
   * console.log(homes);
   */
  async getHomesList() {
    try {
      const familyList = await this._getFamilyList();
      let homes = [];

      for (const h of familyList) {
        let home = {
          id: h?.id,
          name: h?.name
        };

        homes.push(home);
      }

      this._log('Homes:', homes);
      return homes;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  /**
   * Retrieves the list of rooms by home ID.
   * @param {string} id - The home ID.
   * @returns {Promise<Array>} The list of rooms.
   * 
   * @example
   * const rooms = await eWelinkConnect.getRoomsList('home-id');
   * console.log(rooms);
   */
  async getRoomsList(id) {
    const familyList = await this._getFamilyList();
    const family = familyList.find(family => family.id === id);
    if (!family) {
      return [];
    }
    return family.roomList.map(room => ({
      id: room.id,
      name: room.name
    }));
  }

  /**
   * Sets the status of a device.
   * @param {string} deviceId - The ID of the device.
   * @param {Object} params - The parameters to set the device status.
   * 
   * @returns {Promise<void>}
   * @throws {Error} If there is an error setting the device status.
   * @example
   * await eWelinkConnect.setDeviceStatus('device-id', { switch: 'on' });
   */
  async setDeviceStatus(deviceId, params) {
    try {
      await this.client.device.setThingStatus({
        type: 1, //Whether to get device or group. 1=device 2=group
        id: deviceId,
        params: params,
      });
      this._log(`Device status set for deviceId: ${deviceId}`);
    } catch (e) {
      console.error('Failed to set device status:', e);
      throw e;
    }
  }

  /**
   * Retrieves the status of a device.
   * @param {string} deviceId - The ID of the device.
   * @param {Object} params - The parameters to get the device status.
   * 
   * @returns {Promise<Object>} The device status.
   * @throws {Error} If there is an error retrieving the device status.
   * @example
   * const status = await eWelinkConnect.getDeviceStatus('device-id', { switch: 'on' });
   * console.log(status);
   */
  async getDeviceStatus(deviceId, params) {
    try {
      const param = await this.client.device.getThingStatus({
        type: 1, //The things type. 1: user's own device, 2: devices shared by others
        id: deviceId,
        params: params,
      });
      this._log(`Device status get for deviceId: ${deviceId}`);

      return param;
    } catch (e) {
      console.error('Failed to get device status:', e);
      throw e;
    }
  }

}

module.exports = EWeLinkConnect;

/**
 * Example usage:
 * 
 * const EWelinkConnect = require('./EWelinkConnect.js');
 * 
 * const config = {
 *   appId: 'your-app-id',
 *   appSecret: 'your-app-secret',
 *   serverUrl: 'your-server-url',
 *   serverPort: 8000,
 *   region: 'eu',
 *   requestRecord: true,
 * };
 * 
 * const eWelinkConnect = new EWelinkConnect(config);
 * 
 * eWelinkConnect.on('loginSuccess', (token) => {
 *     console.log('Login successful, token:', token);
 * });
 * 
 * eWelinkConnect.on('loginFailure', (error) => {
 *     console.error('Login failed:', error);
 * });
 * 
 * eWelinkConnect.startServer();
 */
