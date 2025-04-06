'use strict';

const Homey = require('homey');

module.exports = class BaseDevice extends Homey.Device {

  /**
   * Update device settings based on provided parameters.
   * @param {object} params The parameters to update.
   */
  async updateDeviceSettings(params) {
    const newSettings = {};

    // Handle 'switch' parameter (update the capability directly)
    if (params.switch !== undefined && this.hasCapability('onoff')) {
      const switchValue = params.switch;
      this.log('Switch value:', switchValue);
      this.setCapabilityValue('onoff', switchValue === 'on');
    }

    // Handle 'switches' parameter (update the capability directly)
    if (params.switches !== undefined && this.hasCapability('onoff')) {
      const switchValue = params.switches[0].switch;
      this.log('Switch value:', switchValue);
      this.setCapabilityValue('onoff', switchValue === 'on');
    }

    // Handle 'battery' parameter (update the capability directly)
    if (params.battery !== undefined && this.hasCapability('measure_battery')) {
      this.log('Battery value:', params.battery);
      this.setCapabilityValue('measure_battery', params.battery);
    }

    // Handle other parameters (populate newSettings)
    if (params.startup !== undefined) {
      newSettings.startup = params.startup;
    }
    if (params.subDevRssi !== undefined) {
      newSettings.subDevRssi = String(params.subDevRssi);
    }
    if (params.wallPenetration !== undefined) {
      newSettings.wallPenetration = params.wallPenetration;
    }
    if (params.sledOnline !== undefined) {
      newSettings.sledOnline = params.sledOnline === 'on';
    }
    if (params.swMode !== undefined) {
      newSettings.swMode = params.swMode.toString();
    }
    if (params.swCtrlReverse !== undefined) {
      newSettings.swCtrlReverse = params.swCtrlReverse === 'on';
    }
    if (params.relaySeparation !== undefined) {
      newSettings.relaySeparation = params.relaySeparation === 1;
    }
    if (params.enableDelay !== undefined) {
      newSettings.enableDelay = params.enableDelay === 1;
    }
    if (params.width !== undefined) {
      newSettings.widthDelay = (params.width / 1000);
    }
    if (params.pulses !== undefined && Array.isArray(params.pulses)) {
      const pulseSettings = params.pulses[0];
      newSettings.pulse = pulseSettings.pulse === 'on';
      newSettings.switchInching = pulseSettings.switch;
      newSettings.widthInching = pulseSettings.width / 1000;
    }
    if (params.configure !== undefined && Array.isArray(params.configure)) {
      const configureSettings = params.configure[0];
      newSettings.startup = configureSettings.startup;
      newSettings.enableDelay = configureSettings.enableDelay === 1;
      newSettings.widthDelay = configureSettings.width / 1000;
    }

    // Apply new settings via setSettings
    if (Object.keys(newSettings).length > 0) {
      this.log('Calling setSettings with:', newSettings);
      await this.setSettings(newSettings);
    }
  }

  /**
   * Initialize the device.
   */
  async initDevice() {
    try {
      const switchStatus = await this.app.eWeLinkConnect.getDeviceStatus(this.getData().id);
      this.log(`ID ${this.getData().id} - Switch status: ${JSON.stringify(switchStatus, null, 2)}`);

      if (switchStatus && switchStatus.data) {
        if (switchStatus.error === 0) {
          const isOnline = await this.app.eWeLinkConnect.isOnline(this.getData().id);

          if (isOnline) {
            const { params } = switchStatus.data;
            //this.log('Params:', params);
            //await this.setAvailable().catch(this.error);
            await this.updateDeviceSettings(params);
          } else {
            this.log('Device is offline');
            await this.setUnavailable(this.homey.__("error.offline")).catch(this.error);
          }
        } else {
          this.error('Error fetching device status:', switchStatus.error, switchStatus.msg);

          let errorMessage;
          switch (switchStatus.error) {
            case 400:
            case 401:
              errorMessage = this.homey.__("error.401");
              break;
            default:
              errorMessage = this.homey.__("error.general");
              break;
          }

          await this.setUnavailable(errorMessage).catch(this.error);
        }
      } else {
        this.error('switchStatus.data is undefined or null');
        await this.setUnavailable(this.homey.__("error.general")).catch(this.error);
      }
    } catch (error) {
      this.error('Failed to initialize device:', error);
      await this.setUnavailable(this.homey.__("error.general")).catch(this.error);
    }
  }

  /**
   * Handle WebSocket messages.
   * @param {object} msg The WebSocket message.
   */
  async onWebSocketMessage(msg) {
    try {
      if (msg && msg.action === 'update') {
        const { deviceid, params } = msg;
        if (deviceid === this.getData().id) {
          await this.updateDeviceSettings(params);
        }
      } else if (msg && msg.action === 'sysmsg') {
        const { deviceid, params } = msg;
        if (deviceid === this.getData().id) {
          if (params.online) {
            this.log('Device is online');

            this.initDevice();
            await this.setAvailable().catch(this.error);
          } else {
            this.log('Device is offline');
            await this.setUnavailable(this.homey.__("error.offline")).catch(this.error);
          }
        }
      }
    } catch (error) {
      this.error('Error handling WebSocket message:', error);
    }
  }

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.log('BaseDevice has been initialized');

    this.app = this.homey.app;
    this.updatingFromApp = false; // Initialize the flag here

    this.initDevice();

    // Register a callback to be notified of WebSocket messages
    this.app.registerWebSocketCallback('wsMessage', (msg) => {
      this.onWebSocketMessage(msg);
    });
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('MyDevice has been added. ws connected:', this.app.eWeLinkConnect.isWebSocketConnected());

    //const initialSwitchStatus = this.getStoreValue('initialSwitch');
    //this.log('Initial switch status:', initialSwitchStatus);
    //this.setCapabilityValue('onoff', initialSwitchStatus === 'on');

    if (!this.app.eWeLinkConnect.isWebSocketConnected()) {
      this.log('Initializing WebSocket service...');
      try {
        const token = this.homey.settings.get('token');

        this.app.registerWebSocketEvents();
        await this.app.eWeLinkConnect.initializeWebSocketService(token);
      } catch (error) {
        this.error('Failed to initialize WebSocket service:', error);
      }
    }
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event The onSettings event data.
   * @param {object} event.oldSettings The old settings object.
   * @param {object} event.newSettings The new settings object.
   * @param {string[]} event.changedKeys An array of keys changed since the previous version.
   * @returns {Promise<string|void>} Return a custom message that will be displayed.
   */
  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('MyDevice settings were changed:', changedKeys, 'old:', oldSettings, 'new:', newSettings);

    for (const k of changedKeys) {
      try {
        let status;
        switch (k) {
          case 'enableDelay':
            status = { enableDelay: newSettings.enableDelay ? 1 : 0 };
            break;
          case 'widthDelay':
            status = { width: newSettings.widthDelay * 1000 };
            break;
          case 'swMode':
          case 'swCtrlReverse':
            status = {
              swMode: parseInt(newSettings.swMode, 10),
              swCtrlReverse: newSettings.swCtrlReverse ? 'on' : 'off'
            };
            break;
          case 'startup':
            status = { startup: newSettings.startup ?? 'off' };
            break;
          case 'relaySeparation':
            status = { relaySeparation: newSettings.relaySeparation ? 1 : 0 };
            break;
          case 'wallPenetration':
            status = { wallPenetration: newSettings.wallPenetration };
            break;
          case 'sledOnline':
            status = { sledOnline: newSettings.sledOnline ? 'on' : 'off' };
            break;
          case 'pulse':
          case 'widthInching':
          case 'switchInching':
            status = {
              pulses: [
                {
                  pulse: newSettings.pulse ? 'on' : 'off',
                  switch: newSettings.switchInching ? 'on' : 'off',
                  width: newSettings.widthInching * 1000,
                  outlet: 0
                }
              ]
            };
            break;
          default:
            status = { [k]: newSettings[k] };
        }

        this.log(`Setting ${k} to: ${newSettings[k]} - status:`, status);
        this.updatingFromApp = true;
        await this.app.eWeLinkConnect.setDeviceStatus(this.getData().id, status);
        this.homey.setTimeout(() => {
          this.updatingFromApp = false;
        }, 5000); // Reset the flag after 5 seconds
      } catch (error) {
        this.error(`Failed to set ${k} to ${newSettings[k]}:`, error);
        this.updatingFromApp = false; // Reset the flag in case of error
      }
    }
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used to synchronize the name to the device.
   * @param {string} name The new name.
   */
  async onRenamed(name) {
    this.log('MyDevice was renamed');
  }

  /**
   * onDeleted is called when the user deletes the device.
   */
  async onDeleted() {
    this.log('MyDevice has been deleted');
  }

};
