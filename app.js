'use strict';

const Homey = require('homey');
const Fs = require('fs');
const Path = require('path');
const EWelinkConnect = require('./lib/EWeLinkConnect');

module.exports = class MyApp extends Homey.App {

  

  async onInit() {
    this.log('MyApp has been initialized');

    

    this.wsCallbacks = {
      wsConnected: [],
      wsDisconnected: [],
      wsError: [],
      wsMessage: []
    };

    this.eWeLinkConnect = null;

    const token = this.homey.settings.get('token');
    const config = this.homey.settings.get('config');

    if (!token || !config) {
      this.error('Token or config is missing');
    } else {
      try {
        this.log('Token and config loaded. Starting eWelink connection');

        this.eWeLinkConnect = new EWelinkConnect(config, false);
        await this.eWeLinkConnect.initializeClient(token);

       
        await this.eWeLinkConnect.initializeWebSocketService(token);
        this.registerWebSocketEvents();
      } catch (error) {
        this.error('Error initializing eWelinkConnect:', error);
      }
    }
  }

  registerWebSocketEvents() {
    this.eWeLinkConnect.on('wsConnected', () => {
      this.log('WebSocket connected');

      this._notifyWebSocketCallbacks('wsConnected');
    });

    this.eWeLinkConnect.on('wsDisconnected', () => {
      this.log('WebSocket disconnected');
      this._notifyWebSocketCallbacks('wsDisconnected');
    });

    this.eWeLinkConnect.on('wsError', (err) => {
      this.error('WebSocket error:', err);
      this._notifyWebSocketCallbacks('wsError', err);
    });

    this.eWeLinkConnect.on('wsMessage', (msg) => {
      this.log('WebSocket message:', JSON.stringify(msg, null, 2));
      this._notifyWebSocketCallbacks('wsMessage', msg);
    });
  }

  _notifyWebSocketCallbacks(event, data) {
    this.wsCallbacks[event].forEach(callback => callback(data));
  }

  registerWebSocketCallback(event, callback) {
    if (this.wsCallbacks[event]) {
      this.wsCallbacks[event].push(callback);
    } else {
      this.error(`Unknown event: ${event}`);
    }
  }
};
