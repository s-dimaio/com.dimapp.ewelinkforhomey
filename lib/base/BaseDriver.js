'use strict';



const Homey = require('homey');
const Os = require('os');
const EWeLinkConnect = require('../EWeLinkConnect');

module.exports = class BaseDriver extends Homey.Driver {

  

  _startLoginService(config, session, repair = false) {
    const loginService = new EWeLinkConnect(config, false);

    // Listen for login events
    loginService.on('loginSuccess', async (token) => {
      try {
        await this._handleLoginSuccess(token, config, session, repair);
      } catch (error) {
        this.error('Error during login success handling:', error);

        this.loginError ||= 500;
        await session.emit("noLogin", this.loginError);
        this.loginError = 0;
      }
    });

    loginService.on('loginFailure', async (error) => {
      this.error('Login failed:', error);

      this.loginError = 500;
      await session.emit("noLogin", this.loginError);
      this.loginError = 0;
    });

    // Start the login process
    return loginService.startServer();
  }

  async _handleLoginSuccess(token, config, session, repair) {
    this.homey.settings.set('config', config);
    this.loginError = token.error;

    if (this.loginError === 0) {
      this.log('Login successful:', token);

      this.homey.settings.set('token', token);

      await this._initializeEWeLinkClient(config, token);

      if (repair) {
        if (!this.app.eWeLinkConnect.isWebSocketConnected()) {
          await this._initializeWebSocket(token, session);
        }
        session.done();
      } else {
        await session.showView('switch_list_devices');
      }
    } else {
      this.error('Login failed:', token.error, token.msg);

      throw new Error(`Login failed: ${token.error} - ${token.msg}`);
    }
  }

  async _initializeEWeLinkClient(config, token) {
    this.app.eWeLinkConnect = new EWeLinkConnect(config, false);
    await this.app.eWeLinkConnect.initializeClient(token);
  }

  async _initializeWebSocket(token, session) {
    this.log('Initializing WebSocket service...');
    this.app.registerWebSocketEvents();
    await this.app.eWeLinkConnect.initializeWebSocketService(token);
  }


  _getIPAddress() {
    const interfaces = Os.networkInterfaces();
    for (const devName in interfaces) {
      const iface = interfaces[devName];
      for (let i = 0; i < iface.length; i++) {
        const alias = iface[i];
        if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
          return alias.address;
        }
      }
    }
    return '0.0.0.0';
  }

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('MyDriver has been initialized');

    this.ipAddress = this._getIPAddress();
    this.app = this.homey.app;
    this.loginError = 0;
  }

  onPair(session) {
    session.setHandler("showView", async (viewId) => {
      this.log('onPair - showView called: ', viewId);

      if (viewId === "opening_loading") {
        if (this.app.eWeLinkConnect && this.app.eWeLinkConnect.isClientInitialized()) {
          this.log('onPair - Client already initialized');

          await session.showView('switch_list_devices');
        } else {
          this.log('onPair - Client not initialized -  show login view');

          await session.showView('ewelink_login_view');
        }
      }

      if (viewId === "ewelink_login_view") {
          await session.emit("ipAddress", this.ipAddress);
      }
    });


    session.setHandler("eWeLinkLogIn", async (data) => {
      this.log('onPair - eWeLinkLogIn called: ', data.appId);

      const config = {
        appId: data.appId,
        appSecret: data.appSecret,
        serverUrl: `http://${this.ipAddress}`,
        serverPort: data.serverPort
      }

      const url = this._startLoginService(config, session);

      

      this.log('URL:', url);

      return url;
    });
  }

  onRepair(session, device) {
    session.setHandler("showView", async (viewId) => {
      this.log('onRepair - showView called: ', viewId);

      if (viewId === "ewelink_repair_view") {
        this.log('onRepair - Show login view');

        const config = this.homey.settings.get('config');
        const ip = this._getIPAddress();
        config.serverUrl = `http://${ip}`;

        await session.emit("config", config);
      }
    });

    // Manages the AmazonPage radio button changes
    session.setHandler("eWeLinkLogIn", async (data) => {
      this.log('onRepair - eWeLinkLogIn called: ', data.appId);

      const config = {
        appId: data.appId,
        appSecret: data.appSecret,
        serverUrl: `http://${this.ipAddress}`,
        serverPort: data.serverPort
      }

      const url = this._startLoginService(config, session, true);

      

      this.log('URL:', url);

      return url;
    });
  }
};
